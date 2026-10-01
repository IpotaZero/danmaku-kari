import { isSmartPhone } from "../../utils/Functions/isSmartPhone"
import { Bullet } from "../Actor/Bullet"
import { CameraTransform } from "../Actor/Camera"
import { BulletGpuBatchRenderer } from "./BulletGpuBatchRenderer"
import { Polygon } from "./Polygon"

export class BulletDrawer {
    private readonly cache = new Map<string, HTMLCanvasElement>()
    private readonly gpu = BulletGpuBatchRenderer.tryCreate()

    private getHalfCanvasSize(bullet: Bullet) {
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

        const hash = this.generateCacheKey(bullet)
        let offscreenCanvas = this.cache.get(hash)

        const halfCanvasSize = this.getHalfCanvasSize(bullet)

        if (!offscreenCanvas) {
            offscreenCanvas = this.drawToOffscreen(bullet, halfCanvasSize)
            this.cache.set(hash, offscreenCanvas)
        }

        const rotation = this.getEffectiveRotation(bullet)

        if (this.gpu?.queue(hash, offscreenCanvas, bullet.p.x, bullet.p.y, rotation, bullet.alpha, halfCanvasSize)) {
            return
        }

        this.drawSpriteDirectly(bullet, ctx, offscreenCanvas, halfCanvasSize, rotation)
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
        ctx.drawImage(offscreenCanvas, -halfCanvasSize, -halfCanvasSize)
        ctx.restore()
    }

    /**
     * 各タイプに応じたオフスクリーンキャンバスの生成
     */
    private drawToOffscreen(bullet: Bullet, halfCanvasSize: number): HTMLCanvasElement {
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
            case "triangle":
                return this.drawTriangle(bullet, halfCanvasSize)
            case "wedge":
            case "diamond":
                return this.drawPolygon(bullet, bullet.appearance, halfCanvasSize)
            default:
                return this.drawPlayer(bullet, halfCanvasSize)
        }
    }

    // 角度情報をキャッシュキーから完全に除外
    private generateCacheKey(bullet: Bullet): string {
        return [bullet.appearance, bullet.color, bullet.r].join(",")
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
        ctx.shadowBlur = isBeam ? bullet.r : 0
        ctx.shadowColor = bullet.color
        ctx.fillStyle = bullet.color
        ctx.fillRect(0, -bullet.r, bullet.length, bullet.r * 2)

        // 白い芯
        ctx.shadowBlur = isBeam ? bullet.r : 0
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

    private drawDonut(bullet: Bullet, halfCanvasSize: number) {
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

    private drawBall(bullet: Bullet, halfCanvasSize: number) {
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
    private drawScore(bullet: Bullet, halfCanvasSize: number) {
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

    private drawPlayer(bullet: Bullet, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        ctx.fillStyle = bullet.color
        ctx.beginPath()
        ctx.arc(center, center, bullet.r, 0, Math.PI * 2)
        ctx.fill()
        return canvas
    }

    private drawLine(bullet: Bullet, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            ctx.shadowBlur = bullet.r * 2
        }
        ctx.translate(center, center)
        ctx.beginPath()
        ctx.moveTo(-bullet.r, 0)
        ctx.lineTo(bullet.r, 0)

        ctx.strokeStyle = bullet.color
        ctx.lineWidth = 3
        ctx.stroke()

        ctx.shadowBlur = 0
        ctx.strokeStyle = "white"
        ctx.lineWidth = 2
        ctx.stroke()
        return canvas
    }

    private drawTriangle(bullet: Bullet, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)

        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            ctx.shadowBlur = bullet.r
        }

        ctx.beginPath()
        for (let i = 0; i < 3; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3
            const x = center + Math.cos(angle) * bullet.r
            const y = center + Math.sin(angle) * bullet.r
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.closePath()

        ctx.strokeStyle = bullet.color
        ctx.stroke()
        return canvas
    }

    // 色付きの光をまとった多角形に、白い芯を重ねる(ballと同じ構成)
    private drawPolygon(bullet: Bullet, type: Polygon.Type, halfCanvasSize: number) {
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
        ctx.fillStyle = bullet.color
        ctx.fill()

        path(0.7)
        ctx.shadowColor = "white"
        ctx.fillStyle = "white"
        ctx.fill()
        return canvas
    }

    private drawArrow(bullet: Bullet, halfCanvasSize: number) {
        const { canvas, ctx, center } = this.createOffscreenCanvas(halfCanvasSize)
        if (!isSmartPhone) {
            ctx.shadowColor = bullet.color
            ctx.shadowBlur = bullet.r * 2
        }
        ctx.translate(center, center)
        ctx.beginPath()
        ctx.moveTo(-bullet.r, 0)
        ctx.lineTo(bullet.r, 0)
        const tipSize = bullet.r * (1 - Math.SQRT1_2)
        const tipWidth = bullet.r * Math.SQRT1_2
        ctx.moveTo(bullet.r, 0)
        ctx.lineTo(tipSize, tipWidth)
        ctx.moveTo(bullet.r, 0)
        ctx.lineTo(tipSize, -tipWidth)
        ctx.strokeStyle = bullet.color
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.strokeStyle = "white"
        ctx.lineWidth = 2
        ctx.stroke()
        return canvas
    }
}
