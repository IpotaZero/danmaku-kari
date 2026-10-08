import { isSmartPhone } from "../../utils/Functions/isSmartPhone"
import { Bullet } from "../Actor/Bullet"
import { CameraTransform } from "../Actor/Camera"
import { BulletGpuBatchRenderer } from "./BulletGpuBatchRenderer"
import { Polygon } from "./Polygon"

// スプライトを描くのに要る、弾の見た目だけ
type Look = Pick<Bullet, "appearance" | "color" | "r">

// 見た目ごとに一度だけ描いておく弾の絵。r は丸めた半径で、描くときに本当の半径まで拡大縮小する
type Sprite = {
    key: string
    canvas: HTMLCanvasElement
    r: number
    halfSize: number
}

// 色相をこの角度ごとに丸めて、スプライトを使い回す。見分けがつかない程度の細かさにする
const HUE_STEP = 5

export class BulletDrawer {
    // スプライトを作ってGPUへ送るのは重く、新しい見た目の弾が出るたびに処理落ちする。
    // 見た目(appearance) → 丸めた色 → 丸めた半径 の順に引き、同じ絵を使い回す。
    // キーの文字列を毎フレーム作らないよう、Mapを入れ子にしている
    private readonly sprites = new Map<Look["appearance"], Map<Color, Map<number, Sprite>>>()
    // 弾の色 → 色相を丸めた色。弾の色は毎フレーム同じ文字列が来るので、丸めた結果を覚えておく
    private readonly spriteColors = new Map<Color, Color>()
    private readonly gpu = BulletGpuBatchRenderer.tryCreate()

    // シャドーのために余白を設ける
    private getHalfCanvasSize(bullet: Look) {
        switch (bullet.appearance) {
            case "player":
                return bullet.r

            case "donut":
            case "score":
                return bullet.r * 2

            case "arrow":
            case "line":
                return bullet.r * 3

            case "ball":
                return bullet.r + 16

            default:
                return bullet.r * 2
        }
    }

    /**
     * メインの描画処理
     */
    public draw(bullet: Bullet, ctx: CanvasRenderingContext2D): void {
        if (Math.floor(bullet.r) === 0 || bullet.alpha === 0) return

        // BeamとLaserはキャッシュせず直接描画（特殊ケース）
        if (bullet.appearance === "beam" || bullet.appearance === "laser") {
            this.drawBeamDirectly(bullet, ctx)
            return
        }

        const sprite = this.getSprite(bullet)
        // スプライトは丸めた半径で描いてあるので、本当の半径の大きさまで拡大縮小する(見た目と当たり判定をずらさない)
        const halfSize = sprite.halfSize * (bullet.r / sprite.r)
        const rotation = this.getEffectiveRotation(bullet)

        if (this.gpu?.queue(sprite.key, sprite.canvas, bullet.p.x, bullet.p.y, rotation, bullet.alpha, halfSize)) {
            return
        }

        this.drawSpriteDirectly(bullet, ctx, sprite.canvas, halfSize, rotation)
    }

    private getSprite(bullet: Bullet): Sprite {
        const color = this.getSpriteColor(bullet.color)
        const r = Math.round(bullet.r)

        let byColor = this.sprites.get(bullet.appearance)
        if (!byColor) {
            byColor = new Map()
            this.sprites.set(bullet.appearance, byColor)
        }

        let byR = byColor.get(color)
        if (!byR) {
            byR = new Map()
            byColor.set(color, byR)
        }

        let sprite = byR.get(r)
        if (!sprite) {
            const look: Look = { appearance: bullet.appearance, color, r }
            const halfSize = this.getHalfCanvasSize(look)
            sprite = { key: [look.appearance, color, r].join(","), canvas: this.drawToOffscreen(look, halfSize), r, halfSize }
            byR.set(r, sprite)
        }

        return sprite
    }

    // 色相を少しずつ変える弾(Behavior.hue や scatter の hue など)は、色が弾ごと・フレームごとに違う。
    // そのままでは色の数だけスプライトを作ってしまうので、hsl の色相を HUE_STEP 度ごとに丸める
    private getSpriteColor(color: Color): Color {
        const cached = this.spriteColors.get(color)
        if (cached) return cached

        const rounded = color.replace(/^hsl\(([^,]+),/, (_, hue: string) => {
            const h = Math.round(Number(hue) / HUE_STEP) * HUE_STEP
            return `hsl(${((h % 360) + 360) % 360},`
        }) as Color

        // ランダムな色相の弾が出続けても覚えておく数が増え続けないよう、増えすぎたら忘れる
        if (this.spriteColors.size > 4096) this.spriteColors.clear()
        this.spriteColors.set(color, rounded)
        return rounded
    }

    /**
     * queue()で溜め込んだ弾をまとめてWebGLで描画し、メインのCanvas2Dへ合成する。
     * カメラ変換込みの最終的な画面座標で焼き込むため、呼び出し側はctxのtransformを
     * 掛けていない状態（Camera.apply()の外）で呼ぶ想定。
     */
    public flush(ctx: CanvasRenderingContext2D, camera: CameraTransform, width: number, height: number): void {
        const canvas = this.gpu?.render(camera, width, height)
        if (canvas) ctx.drawImage(canvas, 0, 0, width, height)
    }

    // Donut と Ball は回転させない（見た目が変わらないため）
    private getEffectiveRotation(bullet: Bullet): number {
        if (bullet.appearance === "donut" || bullet.appearance === "ball") return 0
        return bullet.radian
    }

    // WebGLが使えない環境や、アトラスが満杯だった弾の救済策
    private drawSpriteDirectly(
        bullet: Bullet,
        ctx: CanvasRenderingContext2D,
        offscreenCanvas: HTMLCanvasElement,
        halfCanvasSize: number,
        rotation: number,
    ) {
        ctx.save()
        ctx.globalAlpha = bullet.alpha
        ctx.translate(bullet.p.x, bullet.p.y)
        ctx.rotate(rotation)
        ctx.drawImage(offscreenCanvas, -halfCanvasSize, -halfCanvasSize, halfCanvasSize * 2, halfCanvasSize * 2)
        ctx.restore()
    }

    /**
     * 各タイプに応じたオフスクリーンキャンバスの生成
     */
    private drawToOffscreen(bullet: Look, halfCanvasSize: number): HTMLCanvasElement {
        switch (bullet.appearance) {
            case "donut":
                return this.drawDonut(bullet, halfCanvasSize)
            case "score":
                return this.drawScore(bullet, halfCanvasSize)
            case "arrow":
                return this.drawArrow(bullet, halfCanvasSize)
            case "line":
                return this.drawLine(bullet, halfCanvasSize)
            case "ball":
                return this.drawBall(bullet, halfCanvasSize)
            case "wedge":
            case "diamond":
            case "triangle":
                return this.drawPolygon(bullet, bullet.appearance, halfCanvasSize)
            default:
                return this.drawPlayer(bullet, halfCanvasSize)
        }
    }

    private createOffscreenCanvas(halfCanvasSize: number) {
        const canvas = document.createElement("canvas")
        const size = halfCanvasSize * 2
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext("2d")!
        return { canvas, ctx, center: halfCanvasSize }
    }

    // --- 各外見の描画ロジック ---

    private drawBeamDirectly(bullet: Bullet, ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.globalAlpha = bullet.alpha
        ctx.translate(bullet.p.x, bullet.p.y)
        ctx.rotate(bullet.radian)

        const isBeam = bullet.appearance === "beam"

        // 本体
        ctx.shadowBlur = bullet.r
        ctx.shadowColor = bullet.color
        ctx.fillStyle = bullet.color
        ctx.fillRect(0, -bullet.r, bullet.length, bullet.r * 2)

        // 白い芯
        ctx.shadowBlur = bullet.r
        ctx.shadowColor = "white"
        ctx.fillStyle = "white"
        ctx.fillRect(0, -bullet.r * 0.8, bullet.length, bullet.r * 1.6)

        if (isBeam) {
            ctx.globalCompositeOperation = "lighter"

            const t = performance.now() * 0.01
            const fluctuation = Math.sin(t * 2.0) * 0.08

            ctx.globalAlpha = bullet.alpha * (0.9 + fluctuation)

            const coneLength = bullet.r * 12
            const coneWidth = bullet.r * 8

            // 外側のぼんやりした光
            const outer = ctx.createLinearGradient(0, 0, coneLength, 0)

            outer.addColorStop(0, "rgba(0, 255, 255, 0.22)")
            outer.addColorStop(0.25, "rgba(0, 255, 255, 0.12)")
            outer.addColorStop(0.65, "rgba(0, 255, 255, 0.04)")
            outer.addColorStop(1, "transparent")

            ctx.fillStyle = outer
            ctx.beginPath()
            ctx.moveTo(0, -bullet.r * 1.2)
            ctx.lineTo(coneLength, -coneWidth)
            ctx.lineTo(coneLength, coneWidth)
            ctx.lineTo(0, bullet.r * 1.2)
            ctx.closePath()
            ctx.fill()

            // メインの光
            const cone = ctx.createLinearGradient(0, 0, coneLength, 0)

            cone.addColorStop(0, "rgba(255, 255, 255, 0.9)")
            cone.addColorStop(0.12, "rgba(0, 255, 255, 0.65)")
            cone.addColorStop(0.4, "rgba(0, 255, 255, 0.25)")
            cone.addColorStop(0.75, "rgba(0, 255, 255, 0.06)")
            cone.addColorStop(1, "transparent")

            ctx.fillStyle = cone
            ctx.beginPath()
            ctx.moveTo(0, -bullet.r * 0.65)
            ctx.lineTo(coneLength, -coneWidth * 0.75)
            ctx.lineTo(coneLength, coneWidth * 0.75)
            ctx.lineTo(0, bullet.r * 0.65)
            ctx.closePath()
            ctx.fill()

            // 中心の柔らかい光
            const coreLength = bullet.r * 10

            const core = ctx.createLinearGradient(0, 0, coreLength, 0)

            core.addColorStop(0, "rgba(255,255,255,0.95)")
            core.addColorStop(0.2, "rgba(255,255,255,0.8)")
            core.addColorStop(0.5, "rgba(200,255,255,0.25)")
            core.addColorStop(1, "transparent")

            ctx.fillStyle = core
            ctx.beginPath()
            ctx.moveTo(0, -bullet.r * 0.28)
            ctx.lineTo(coreLength, 0)
            ctx.lineTo(0, bullet.r * 0.28)
            ctx.closePath()
            ctx.fill()

            // 根元
            const flare = ctx.createRadialGradient(0, 0, bullet.r * 0.2, 0, 0, bullet.r * 3)

            flare.addColorStop(0, "rgba(255,255,255,0.95)")
            flare.addColorStop(0.25, "rgba(255,255,255,0.7)")
            flare.addColorStop(0.55, "rgba(0,255,255,0.25)")
            flare.addColorStop(1, "transparent")

            ctx.fillStyle = flare
            ctx.beginPath()
            ctx.arc(0, 0, bullet.r * 3, 0, Math.PI * 2)
            ctx.fill()

            ctx.globalCompositeOperation = "source-over"
            ctx.globalAlpha = bullet.alpha
        }

        ctx.restore()
    }

    private drawDonut(bullet: Look, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        ctx.beginPath()
        ctx.arc(center, center, bullet.r, 0, Math.PI * 2)
        ctx.shadowColor = bullet.color
        ctx.shadowBlur = bullet.r
        ctx.strokeStyle = bullet.color
        ctx.lineWidth = 3
        ctx.stroke()

        if (!isSmartPhone) ctx.shadowBlur = bullet.r / 2
        ctx.strokeStyle = "white"
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.stroke()
        return canvas
    }

    private drawBall(bullet: Look, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        ctx.beginPath()
        ctx.arc(center, center, bullet.r, 0, Math.PI * 2)
        ctx.shadowColor = bullet.color
        ctx.shadowBlur = 14
        ctx.fillStyle = bullet.color
        ctx.fill()

        ctx.beginPath()
        const innerR = bullet.r > 1 ? Math.min(bullet.r - 1, bullet.r * 0.9) : bullet.r * 0.9
        ctx.arc(center, center, innerR, 0, Math.PI * 2)
        ctx.shadowColor = "white"
        ctx.fillStyle = "white"
        ctx.fill()
        return canvas
    }

    // オフスクリーン描画時の回転を削除（メインのdrawで回転させる）
    private drawScore(bullet: Look, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            ctx.shadowBlur = bullet.r * 2
        }
        ctx.translate(center, center)
        ctx.fillStyle = bullet.color
        ctx.fillRect(-bullet.r, -bullet.r, bullet.r * 2, bullet.r * 2)
        return canvas
    }

    private drawPlayer(bullet: Look, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        ctx.fillStyle = bullet.color
        ctx.beginPath()
        ctx.arc(center, center, bullet.r, 0, Math.PI * 2)
        ctx.fill()
        return canvas
    }

    private drawLine(bullet: Look, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            // 光を広げすぎると色が薄まるので、本体付近に集める
            ctx.shadowBlur = bullet.r
        }

        ctx.translate(center, center)

        ctx.beginPath()
        ctx.moveTo(-bullet.r, 0)
        ctx.lineTo(bullet.r, 0)

        ctx.strokeStyle = bullet.color
        ctx.lineWidth = 3
        ctx.stroke()

        // 白い芯は細くして、本来の色を見せる(全体の太さは3のまま)
        ctx.strokeStyle = "white"
        ctx.lineWidth = 1
        ctx.stroke()

        return canvas
    }

    // 色付きの光をまとった多角形に、白い芯を重ねる(ballと同じ構成)
    private drawPolygon(bullet: Look, type: Polygon.Type, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        ctx.translate(center, center)

        const path = (scale: number) => {
            ctx.beginPath()
            Polygon.vertices(type, bullet.r).forEach((v, i) => {
                if (i === 0) ctx.moveTo(v.x * scale, v.y * scale)
                else ctx.lineTo(v.x * scale, v.y * scale)
            })
            ctx.closePath()
        }

        path(1)
        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            ctx.shadowBlur = 14
        }
        ctx.lineWidth = 2
        ctx.strokeStyle = bullet.color
        ctx.stroke()

        path(1)
        ctx.lineWidth = 1
        ctx.shadowColor = "white"
        ctx.strokeStyle = "white"
        ctx.stroke()
        return canvas
    }

    private drawArrow(bullet: Look, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            // 光を広げすぎると色が薄まるので、本体付近に集める
            ctx.shadowBlur = bullet.r
        }

        const tipSize = bullet.r * (1 - Math.SQRT1_2)
        const tipWidth = bullet.r * Math.SQRT1_2

        ctx.translate(center, center)

        ctx.beginPath()
        ctx.moveTo(-bullet.r, 0)
        ctx.lineTo(bullet.r, 0)
        ctx.moveTo(bullet.r, 0)
        ctx.lineTo(tipSize, tipWidth)
        ctx.moveTo(bullet.r, 0)
        ctx.lineTo(tipSize, -tipWidth)

        ctx.strokeStyle = bullet.color
        ctx.lineWidth = 3
        ctx.stroke()

        // 白い芯は細くして、本来の色を見せる(全体の太さは3のまま)
        ctx.strokeStyle = "white"
        ctx.lineWidth = 1
        ctx.stroke()

        return canvas
    }
}
