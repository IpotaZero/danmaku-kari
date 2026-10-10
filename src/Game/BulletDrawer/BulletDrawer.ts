import { isSmartPhone } from "../../utils/Functions/isSmartPhone"
import { Bullet } from "../Actor/Bullet"
import { CameraTransform } from "../Actor/Camera"
import { BulletGpuBatchRenderer } from "./BulletGpuBatchRenderer"
import { Polygon } from "./Polygon"

// スプライトの種類。弾の見た目のほかに、ビームの根元の光を別のスプライトにしている
type SpriteKind = Bullet["appearance"] | "beam-flare"

// スプライトを描くのに要る、弾の見た目だけ
type Look = { appearance: SpriteKind; color: Color; r: number }

// 見た目ごとに一度だけ描いておく弾の絵。r は丸めた半径で、描くときに本当の半径まで拡大縮小する
type Sprite = {
    key: string
    canvas: HTMLCanvasElement
    r: number
}

// ビーム・レーザーの光(shadowBlur = r)が収まるよう、スプライトの本体のまわりに空ける余白。半径の何倍か
const RECT_MARGIN = 2

// 色相をこの角度ごとに丸めて、スプライトを使い回す。見分けがつかない程度の細かさにする
const HUE_STEP = 5

export class BulletDrawer {
    // スプライトを作ってGPUへ送るのは重く、新しい見た目の弾が出るたびに処理落ちする。
    // 見た目(appearance) → 丸めた色 → 丸めた半径 の順に引き、同じ絵を使い回す。
    // キーの文字列を毎フレーム作らないよう、Mapを入れ子にしている
    private readonly sprites = new Map<SpriteKind, Map<Color, Map<number, Sprite>>>()
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

        if (bullet.appearance === "beam" || bullet.appearance === "laser") {
            this.drawRect(bullet, ctx)
            return
        }

        const sprite = this.getSprite(bullet.appearance, bullet.color, bullet.r)
        // スプライトは丸めた半径で描いてあるので、本当の半径の大きさまで拡大縮小する(見た目と当たり判定をずらさない)
        const halfSize = (sprite.canvas.width / 2) * (bullet.r / sprite.r)
        const rotation = this.getEffectiveRotation(bullet)

        if (
            this.gpu?.queue(sprite.key, sprite.canvas, bullet.p.x, bullet.p.y, rotation, bullet.alpha, halfSize, halfSize, 0, 1)
        ) {
            return
        }

        this.drawSpriteDirectly(bullet, ctx, sprite.canvas, halfSize, rotation)
    }

    // ビーム・レーザー(当たり判定がrect)。本体と、ビームなら根元の光を描く。GPUに積めなければCanvas2Dへ直接描く
    private drawRect(bullet: Bullet, ctx: CanvasRenderingContext2D) {
        if (!this.queueRectBody(bullet)) this.drawRectBodyDirectly(bullet, ctx)
        if (bullet.appearance === "beam" && !this.queueBeamFlare(bullet)) this.drawBeamFlareDirectly(bullet, ctx)
    }

    // 長さは弾ごとにまちまちなので、本体のスプライトを 始端・中ほど・終端 の3つに切り分け、中ほどだけを長さに合わせて引き伸ばす。
    // スプライトは長さ 4m の中の m から 3m に本体を描いてある(m は光のための余白)。中ほどにはその真ん中の1列を使う
    private queueRectBody(bullet: Bullet): boolean {
        const gpu = this.gpu
        if (!gpu) return false
        // 長さ0の長方形は、光も含めて何も描かれない(Canvas2Dと同じ)
        if (bullet.length <= 0) return true

        const sprite = this.getSprite(bullet.appearance, bullet.color, bullet.r)
        const scale = bullet.r / sprite.r
        const margin = sprite.r * RECT_MARGIN * scale
        const halfHeight = (sprite.canvas.height / 2) * scale
        // 本体が短くて中ほどがないときは、両端を本体の真ん中で突き合わせる
        const cap = Math.min(margin, bullet.length / 2)
        const capU = (margin + cap) / (margin * 4)
        const cos = Math.cos(bullet.radian)
        const sin = Math.sin(bullet.radian)

        // 弾の位置から向きの方向へ from から to までを、スプライトの横方向 uFrom から uTo で描く
        const queue = (from: number, to: number, uFrom: number, uTo: number) => {
            const center = (from + to) / 2
            return gpu.queue(
                sprite.key,
                sprite.canvas,
                bullet.p.x + cos * center,
                bullet.p.y + sin * center,
                bullet.radian,
                bullet.alpha,
                (to - from) / 2,
                halfHeight,
                uFrom,
                uTo,
            )
        }

        // 3つとも同じスプライトなので、積めるかどうかはそろう
        return (
            queue(-margin, cap, 0, capU) &&
            (bullet.length <= margin * 2 || queue(margin, bullet.length - margin, 0.5, 0.5)) &&
            queue(bullet.length - cap, bullet.length + margin, 1 - capU, 1)
        )
    }

    // 根元の光のスプライトは、まとう光の分も含めて、向きの方向に -5r から 14r、直角の方向に -10r から 10r を描いてある
    private queueBeamFlare(bullet: Bullet): boolean {
        if (!this.gpu) return false

        // 根元の光の色は弾の色によらないので、色は一つに決めて使い回す
        const sprite = this.getSprite("beam-flare", "aqua", bullet.r)
        const scale = bullet.r / sprite.r
        const center = 4.5 * bullet.r

        return this.gpu.queue(
            sprite.key,
            sprite.canvas,
            bullet.p.x + Math.cos(bullet.radian) * center,
            bullet.p.y + Math.sin(bullet.radian) * center,
            bullet.radian,
            bullet.alpha * this.beamFlicker(),
            (sprite.canvas.width / 2) * scale,
            (sprite.canvas.height / 2) * scale,
            0,
            1,
        )
    }

    // 根元の光をゆらめかせる濃さ
    private beamFlicker(): number {
        return 0.9 + Math.sin(performance.now() * 0.02) * 0.08
    }

    private getSprite(kind: SpriteKind, rawColor: Color, rawR: number): Sprite {
        const color = this.getSpriteColor(rawColor)
        const r = Math.round(rawR)

        let byColor = this.sprites.get(kind)
        if (!byColor) {
            byColor = new Map()
            this.sprites.set(kind, byColor)
        }

        let byR = byColor.get(color)
        if (!byR) {
            byR = new Map()
            byColor.set(color, byR)
        }

        let sprite = byR.get(r)
        if (!sprite) {
            sprite = { key: [kind, color, r].join(","), canvas: this.drawToOffscreen({ appearance: kind, color, r }), r }
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
    private drawToOffscreen(bullet: Look): HTMLCanvasElement {
        const halfCanvasSize = this.getHalfCanvasSize(bullet)

        switch (bullet.appearance) {
            case "beam":
            case "laser":
                return this.drawRectBody(bullet)
            case "beam-flare":
                return this.drawBeamFlare(bullet)
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

    // ビーム・レーザーの本体(色の長方形に白い芯)。原点から向きの方向へ length だけ描く
    private paintRectBody(ctx: CanvasRenderingContext2D, color: Color, r: number, length: number) {
        ctx.shadowBlur = r
        ctx.shadowColor = color
        ctx.fillStyle = color
        ctx.fillRect(0, -r, length, r * 2)

        // 白い芯
        ctx.shadowBlur = r
        ctx.shadowColor = "white"
        ctx.fillStyle = "white"
        ctx.fillRect(0, -r * 0.8, length, r * 1.6)
    }

    // ビームの根元の光。原点が根元で、向きの方向へ広がる
    private paintBeamFlare(ctx: CanvasRenderingContext2D, r: number) {
        // 本体の白い芯と同じ白い光をまとわせる
        ctx.shadowBlur = r
        ctx.shadowColor = "white"

        const coneLength = r * 12
        const coneWidth = r * 8

        // 外側のぼんやりした光
        const outer = ctx.createLinearGradient(0, 0, coneLength, 0)

        outer.addColorStop(0, "rgba(0, 255, 255, 0.22)")
        outer.addColorStop(0.25, "rgba(0, 255, 255, 0.12)")
        outer.addColorStop(0.65, "rgba(0, 255, 255, 0.04)")
        outer.addColorStop(1, "transparent")

        ctx.fillStyle = outer
        ctx.beginPath()
        ctx.moveTo(0, -r * 1.2)
        ctx.lineTo(coneLength, -coneWidth)
        ctx.lineTo(coneLength, coneWidth)
        ctx.lineTo(0, r * 1.2)
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
        ctx.moveTo(0, -r * 0.65)
        ctx.lineTo(coneLength, -coneWidth * 0.75)
        ctx.lineTo(coneLength, coneWidth * 0.75)
        ctx.lineTo(0, r * 0.65)
        ctx.closePath()
        ctx.fill()

        // 中心の柔らかい光
        const coreLength = r * 10

        const core = ctx.createLinearGradient(0, 0, coreLength, 0)

        core.addColorStop(0, "rgba(255,255,255,0.95)")
        core.addColorStop(0.2, "rgba(255,255,255,0.8)")
        core.addColorStop(0.5, "rgba(200,255,255,0.25)")
        core.addColorStop(1, "transparent")

        ctx.fillStyle = core
        ctx.beginPath()
        ctx.moveTo(0, -r * 0.28)
        ctx.lineTo(coreLength, 0)
        ctx.lineTo(0, r * 0.28)
        ctx.closePath()
        ctx.fill()

        // 根元
        const flare = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 3)

        flare.addColorStop(0, "rgba(255,255,255,0.95)")
        flare.addColorStop(0.25, "rgba(255,255,255,0.7)")
        flare.addColorStop(0.55, "rgba(0,255,255,0.25)")
        flare.addColorStop(1, "transparent")

        ctx.fillStyle = flare
        ctx.beginPath()
        ctx.arc(0, 0, r * 3, 0, Math.PI * 2)
        ctx.fill()
    }

    private drawRectBody(look: Look): HTMLCanvasElement {
        const margin = look.r * RECT_MARGIN
        const canvas = document.createElement("canvas")
        canvas.width = margin * 4
        canvas.height = look.r * 2 + margin * 2

        const ctx = canvas.getContext("2d")!
        // メインのキャンバスと同じく、加算で重ねる
        ctx.globalCompositeOperation = "lighter"
        ctx.translate(margin, canvas.height / 2)
        this.paintRectBody(ctx, look.color, look.r, margin * 2)
        return canvas
    }

    private drawBeamFlare(look: Look): HTMLCanvasElement {
        const canvas = document.createElement("canvas")
        canvas.width = look.r * 19
        canvas.height = look.r * 20

        const ctx = canvas.getContext("2d")!
        ctx.globalCompositeOperation = "lighter"
        ctx.translate(look.r * 5, look.r * 10)
        this.paintBeamFlare(ctx, look.r)
        return canvas
    }

    // WebGLが使えない環境や、アトラスが満杯だったときの救済策
    private drawRectBodyDirectly(bullet: Bullet, ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.globalAlpha = bullet.alpha
        ctx.translate(bullet.p.x, bullet.p.y)
        ctx.rotate(bullet.radian)
        this.paintRectBody(ctx, bullet.color, bullet.r, bullet.length)
        ctx.restore()
    }

    private drawBeamFlareDirectly(bullet: Bullet, ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.globalCompositeOperation = "lighter"
        ctx.globalAlpha = bullet.alpha * this.beamFlicker()
        ctx.translate(bullet.p.x, bullet.p.y)
        ctx.rotate(bullet.radian)
        this.paintBeamFlare(ctx, bullet.r)
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
