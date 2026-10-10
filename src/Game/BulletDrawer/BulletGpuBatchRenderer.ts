import { CameraTransform } from "../Actor/Camera"
import { BulletSpriteAtlas } from "./BulletSpriteAtlas"

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_instancePos;
layout(location = 2) in float a_instanceRotation;
layout(location = 3) in float a_instanceAlpha;
layout(location = 4) in vec2 a_instanceHalfSize;
layout(location = 5) in vec4 a_instanceUv;

uniform vec2 u_canvasSize;
uniform vec2 u_camPos;
uniform float u_camAngle;
uniform float u_camScale;

out vec2 v_uv;
out float v_alpha;

vec2 rotate(vec2 v, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

void main() {
    // 弾自身のローカル回転（Ctx.rotate(bullet.radian) 相当）。x が弾の向き(ビームなら長さの方向)
    vec2 local = a_corner * a_instanceHalfSize;
    vec2 worldPos = a_instancePos + rotate(local, a_instanceRotation);

    // Camera.apply() と同じ変換（translate -> rotate -> scale -> translate）をGPU側で再現する
    vec2 camRelative = (worldPos - u_camPos) * u_camScale;
    vec2 device = rotate(camRelative, u_camAngle) + u_canvasSize * 0.5;

    vec2 clip = vec2(device.x / (u_canvasSize.x * 0.5) - 1.0, 1.0 - device.y / (u_canvasSize.y * 0.5));
    gl_Position = vec4(clip, 0.0, 1.0);

    v_uv = mix(a_instanceUv.xy, a_instanceUv.zw, a_corner * 0.5 + 0.5);
    v_alpha = a_instanceAlpha;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec2 v_uv;
in float v_alpha;

uniform sampler2D u_atlas;

out vec4 outColor;

void main() {
    outColor = texture(u_atlas, v_uv) * v_alpha;
}
`

const FLOATS_PER_INSTANCE = 10

/**
 * 弾スプライトをインスタンシングで1回のドローコールにまとめて描くレンダラー。
 * オフスクリーンのWebGLキャンバスに描き、呼び出し側がその結果をdrawImageで
 * メインのCanvas2Dへ合成する（カメラ変換込みで最終的な画面座標に焼き込まれている）。
 */
export class BulletGpuBatchRenderer {
    private readonly canvas = document.createElement("canvas")
    private readonly gl: WebGL2RenderingContext
    private readonly program: WebGLProgram
    private readonly vao: WebGLVertexArrayObject
    private readonly instanceBuffer: WebGLBuffer
    private readonly atlas: BulletSpriteAtlas

    private readonly canvasSizeLocation: WebGLUniformLocation
    private readonly camPosLocation: WebGLUniformLocation
    private readonly camAngleLocation: WebGLUniformLocation
    private readonly camScaleLocation: WebGLUniformLocation

    private instanceData = new Float32Array(FLOATS_PER_INSTANCE * 256)
    private instanceCount = 0

    static tryCreate(): BulletGpuBatchRenderer | null {
        try {
            return new BulletGpuBatchRenderer()
        } catch (e) {
            console.warn("WebGLでの弾描画の初期化に失敗したため、Canvas2Dで描画します", e)
            return null
        }
    }

    private constructor() {
        const gl = this.canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true })
        if (!gl) throw new Error("WebGL2 is not available")
        this.gl = gl

        this.program = this.createProgram()

        this.canvasSizeLocation = this.getUniformLocation("u_canvasSize")
        this.camPosLocation = this.getUniformLocation("u_camPos")
        this.camAngleLocation = this.getUniformLocation("u_camAngle")
        this.camScaleLocation = this.getUniformLocation("u_camScale")

        this.atlas = new BulletSpriteAtlas(gl, this.createTexture())
        this.instanceBuffer = this.createBuffer()
        this.vao = this.createVao(this.createQuadBuffer(), this.instanceBuffer)

        // メインのCanvas2D側はglobalCompositeOperation = "lighter"(加算合成)で弾を描いているが、
        // ここがONE_MINUS_SRC_ALPHA(通常のアルファ合成)のままだと、GPUでまとめ描きした弾同士は
        // 重なっても明るくならず、Canvas2Dへ直接描くフォールバック分とだけ見た目がずれてしまう。
        // 加算合成に合わせて重なった弾が明るくなるようにする
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
    }

    /**
     * スプライトを1枚、今フレームのバッチに積む。アトラスが満杯で置き場所がなければfalseを返す。
     * (x, y) を中心に、向き rotation の方向へ halfWidth、それと直角の方向へ halfHeight の大きさで描く。
     * uFrom から uTo はスプライトの横方向のどこからどこまでを使うか(0~1)。ビームはこれで端と中ほどを切り分けて引き伸ばす
     */
    queue(
        key: string,
        source: HTMLCanvasElement,
        x: number,
        y: number,
        rotation: number,
        alpha: number,
        halfWidth: number,
        halfHeight: number,
        uFrom: number,
        uTo: number,
    ): boolean {
        const uv = this.atlas.get(key, source)
        if (!uv) return false

        this.ensureCapacity(this.instanceCount + 1)
        // 弾ごとにオブジェクトを作らないよう、UVは数のまま渡す
        this.writeInstance(
            this.instanceCount,
            x,
            y,
            rotation,
            alpha,
            halfWidth,
            halfHeight,
            uv.u0 + (uv.u1 - uv.u0) * uFrom,
            uv.v0,
            uv.u0 + (uv.u1 - uv.u0) * uTo,
            uv.v1,
        )
        this.instanceCount++

        return true
    }

    /**
     * 積んだ弾をまとめて描画し、結果のキャンバスを返す（1体も無ければnull）。
     * 呼ぶたびに次フレーム分のキューをリセットする。
     */
    render(camera: CameraTransform, width: number, height: number): HTMLCanvasElement | null {
        const count = this.instanceCount
        this.instanceCount = 0
        if (count === 0) return null

        const gl = this.gl

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width
            this.canvas.height = height
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)

        gl.useProgram(this.program)
        gl.bindVertexArray(this.vao)

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.subarray(0, count * FLOATS_PER_INSTANCE), gl.DYNAMIC_DRAW)

        gl.uniform2f(this.canvasSizeLocation, width, height)
        gl.uniform2f(this.camPosLocation, camera.x, camera.y)
        gl.uniform1f(this.camAngleLocation, camera.angle)
        gl.uniform1f(this.camScaleLocation, camera.scale)

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)

        return this.canvas
    }

    private writeInstance(
        index: number,
        x: number,
        y: number,
        rotation: number,
        alpha: number,
        halfWidth: number,
        halfHeight: number,
        u0: number,
        v0: number,
        u1: number,
        v1: number,
    ) {
        const offset = index * FLOATS_PER_INSTANCE
        const d = this.instanceData

        d[offset + 0] = x
        d[offset + 1] = y
        d[offset + 2] = rotation
        d[offset + 3] = alpha
        d[offset + 4] = halfWidth
        d[offset + 5] = halfHeight
        d[offset + 6] = u0
        d[offset + 7] = v0
        d[offset + 8] = u1
        d[offset + 9] = v1
    }

    private ensureCapacity(instanceCount: number) {
        const needed = instanceCount * FLOATS_PER_INSTANCE
        if (needed <= this.instanceData.length) return

        const grown = new Float32Array(Math.max(needed, this.instanceData.length * 2))
        grown.set(this.instanceData)
        this.instanceData = grown
    }

    private getUniformLocation(name: string): WebGLUniformLocation {
        const location = this.gl.getUniformLocation(this.program, name)
        if (!location) throw new Error(`${name} uniform not found`)
        return location
    }

    private createProgram(): WebGLProgram {
        const gl = this.gl
        const program = gl.createProgram()
        if (!program) throw new Error("Failed to create WebGL program")

        gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER))
        gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
        gl.linkProgram(program)

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program)
            gl.deleteProgram(program)
            throw new Error(`Failed to link WebGL program: ${log}`)
        }

        return program
    }

    private createShader(type: number, source: string): WebGLShader {
        const gl = this.gl
        const shader = gl.createShader(type)
        if (!shader) throw new Error("Failed to create WebGL shader")

        gl.shaderSource(shader, source)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader)
            gl.deleteShader(shader)
            throw new Error(`Failed to compile WebGL shader: ${log}`)
        }

        return shader
    }

    private createTexture(): WebGLTexture {
        const texture = this.gl.createTexture()
        if (!texture) throw new Error("Failed to create WebGL texture")
        return texture
    }

    private createBuffer(): WebGLBuffer {
        const buffer = this.gl.createBuffer()
        if (!buffer) throw new Error("Failed to create WebGL buffer")
        return buffer
    }

    private createQuadBuffer(): WebGLBuffer {
        const gl = this.gl
        const buffer = this.createBuffer()

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

        return buffer
    }

    private createVao(quadBuffer: WebGLBuffer, instanceBuffer: WebGLBuffer): WebGLVertexArrayObject {
        const gl = this.gl
        const vao = gl.createVertexArray()
        if (!vao) throw new Error("Failed to create WebGL vertex array object")

        gl.bindVertexArray(vao)

        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

        const stride = FLOATS_PER_INSTANCE * 4
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)

        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0)
        gl.vertexAttribDivisor(1, 1)

        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 2 * 4)
        gl.vertexAttribDivisor(2, 1)

        gl.enableVertexAttribArray(3)
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 3 * 4)
        gl.vertexAttribDivisor(3, 1)

        gl.enableVertexAttribArray(4)
        gl.vertexAttribPointer(4, 2, gl.FLOAT, false, stride, 4 * 4)
        gl.vertexAttribDivisor(4, 1)

        gl.enableVertexAttribArray(5)
        gl.vertexAttribPointer(5, 4, gl.FLOAT, false, stride, 6 * 4)
        gl.vertexAttribDivisor(5, 1)

        gl.bindVertexArray(null)
        return vao
    }
}
