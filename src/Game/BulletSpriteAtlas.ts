export type AtlasUv = {
    u0: number
    v0: number
    u1: number
    v1: number
}

/**
 * 弾のスプライト（見た目ごとに1枚のオフスクリーンcanvas）を
 * 1枚の大きなテクスチャに敷き詰めて使い回すためのクラス。
 * 同じキー（appearance, color, r）はテクスチャへの再アップロードをしない。
 */
export class BulletSpriteAtlas {
    static readonly SIZE = 1024

    private readonly slots = new Map<string, AtlasUv>()

    private cursorX = 0
    private cursorY = 0
    private rowHeight = 0

    constructor(
        private readonly gl: WebGL2RenderingContext,
        readonly texture: WebGLTexture,
    ) {
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            BulletSpriteAtlas.SIZE,
            BulletSpriteAtlas.SIZE,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    /**
     * keyに対応するUV領域を返す。未登録ならsourceを新しい領域へ焼き込む。
     * アトラスが満杯で置き場所がない場合はnullを返す（呼び出し側はCanvas2Dへフォールバックする）。
     */
    get(key: string, source: HTMLCanvasElement): AtlasUv | null {
        const cached = this.slots.get(key)
        if (cached) return cached

        const pos = this.pack(source.width, source.height)
        if (!pos) return null

        const gl = this.gl
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
        gl.texSubImage2D(gl.TEXTURE_2D, 0, pos.x, pos.y, gl.RGBA, gl.UNSIGNED_BYTE, source)

        const uv: AtlasUv = {
            u0: pos.x / BulletSpriteAtlas.SIZE,
            v0: pos.y / BulletSpriteAtlas.SIZE,
            u1: (pos.x + source.width) / BulletSpriteAtlas.SIZE,
            v1: (pos.y + source.height) / BulletSpriteAtlas.SIZE,
        }
        this.slots.set(key, uv)
        return uv
    }

    private pack(w: number, h: number): { x: number; y: number } | null {
        if (this.cursorX + w > BulletSpriteAtlas.SIZE) {
            this.cursorX = 0
            this.cursorY += this.rowHeight
            this.rowHeight = 0
        }
        if (this.cursorY + h > BulletSpriteAtlas.SIZE) return null

        const pos = { x: this.cursorX, y: this.cursorY }
        this.cursorX += w
        this.rowHeight = Math.max(this.rowHeight, h)
        return pos
    }
}
