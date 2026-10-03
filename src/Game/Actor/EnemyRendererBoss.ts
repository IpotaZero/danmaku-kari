import { Enemy } from "./Enemy"
import { IEnemyRenderer } from "./IEnemyRenderer"
import { DeathEffect } from "./DeathEffect"
import { Ctx } from "../../utils/Functions/Ctx"
import { vec } from "@ipota/vec"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"

const WHITE = "#ffffff80"
const GOLD = "rgba(255, 215, 0, 0.6)"
const RED = "rgba(255, 60, 60, 0.6)"
const CYAN = "rgba(0, 255, 255, 0.4)"
const BLACK_VALE = "rgba(255, 255, 255, 0.2)"
const BLUE = "rgba(60, 140, 255, 0.8)"
const CHARGE_FILL = "rgba(140, 200, 255, 0.95)"
const HITBOX_FILL = "rgba(255, 255, 255, 0.06)"
const HITBOX_EDGE = "rgba(255, 255, 255, 0.75)"

export class EnemyRendererBoss implements IEnemyRenderer {
    *onDead(e: Enemy) {
        yield* DeathEffect.bossDefeat(e)
    }

    draw(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const orbitTheta = e.frame / 60
        const pulse = Math.sin(e.frame / 15) * 0.05

        this.drawBossHpBar(ctx, e)
        this.drawMagicCircle(ctx, e, orbitTheta, pulse)
        this.drawMiddleFrame(ctx, e, orbitTheta)

        this.drawCoreComplex(ctx, e, orbitTheta, pulse)

        this.drawCoreBits(ctx, e, orbitTheta)
        this.drawRoundBits(ctx, e, orbitTheta)
        this.drawHitBox(ctx, e, pulse)
    }

    /**
     * 上部に大きく表示されるボス専用HPゲージ。
     * 充電中はHPバーを青くし、直下に充電進捗バーを表示する。
     */
    private drawBossHpBar(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const isCharging = e.chargeRemaining > 0
        const width = e.game.WIDTH * 0.8
        const height = 24
        // ワールド座標は左上原点の [0, WIDTH] x [0, HEIGHT]
        const x = (e.game.WIDTH - width) / 2
        const y = 30

        ctx.save()
        ctx.translate(0, y)

        // 外枠と背景（共通）
        Ctx.rect(ctx, { x, y: 0 }, vec(width, height), "rgba(255, 255, 255, 0.1)", {
            lineWidth: 2,
        })

        if (isCharging && e.chargeMax > 0) {
            // 充電中：充電進捗バーのみ表示
            const chargeRatio = 1 - e.chargeRemaining / e.chargeMax

            Ctx.rect(ctx, { x, y: 0 }, vec(width * chargeRatio, height), CHARGE_FILL)
            Ctx.rect(ctx, { x, y: height * 0.7 }, vec(width * chargeRatio, height * 0.3), "rgba(255, 255, 255, 0.3)")

            for (let i = 0; i <= 10; i++) {
                const mx = x + (width / 10) * i
                ctx.strokeStyle = BLUE
                ctx.beginPath()
                ctx.moveTo(mx, -4)
                ctx.lineTo(mx, height + 4)
                ctx.stroke()
            }
        } else {
            // 通常時：HPバーを表示
            const hpRatio = e.life / e.maxLife
            const color = e.damaged || e.isInvincible ? RED : CYAN

            Ctx.rect(ctx, { x, y: 0 }, vec(width * hpRatio, height), color)
            Ctx.rect(ctx, { x, y: height * 0.7 }, vec(width * hpRatio, height * 0.3), "rgba(255, 255, 255, 0.3)")

            for (let i = 0; i <= 10; i++) {
                const mx = x + (width / 10) * i
                ctx.strokeStyle = WHITE
                ctx.beginPath()
                ctx.moveTo(mx, -4)
                ctx.lineTo(mx, height + 4)
                ctx.stroke()
            }
        }

        ctx.restore()
    }

    /**
     * 重なり合う回転リングと刻み目（ルーン）の描画
     */
    private drawMagicCircle(ctx: CanvasRenderingContext2D, e: Enemy, theta: number, pulse: number): void {
        const radii = [1.5, 1.8, 2.2]

        radii.forEach((rMul, idx) => {
            const r = e.r * rMul * (1 + pulse * (idx + 1))
            const dir = idx % 2 === 0 ? 1 : -1
            const currentTheta = theta * dir * (0.5 + idx * 0.2)

            Ctx.arc(ctx, e.p, r, idx === 1 ? GOLD : CYAN, { lineWidth: 1 })

            const count = 12 + idx * 6
            for (let i = 0; i < count; i++) {
                const angle = (i * T) / count + currentTheta
                const p1 = e.p.add(vec(r, 0).rotate(angle))
                const p2 = e.p.add(vec(r + 8, 0).rotate(angle))

                ctx.strokeStyle = idx === 1 ? GOLD : WHITE
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(p1.x, p1.y)
                ctx.lineTo(p2.x, p2.y)
                ctx.stroke()
            }
        })
    }

    private drawMiddleFrame(ctx: CanvasRenderingContext2D, e: Enemy, theta: number): void {
        Ctx.polygon(ctx, 8, 2, e.p, e.r * 2, BLACK_VALE, {
            theta: theta * 0.2,
            lineWidth: 3,
        })
        Ctx.polygon(ctx, 13, 3, e.p, e.r * 4, BLACK_VALE, {
            theta: -theta * 0.2,
            lineWidth: 2,
        })
    }

    private drawCoreBits(ctx: CanvasRenderingContext2D, e: Enemy, theta: number): void {
        const bitCount = 5
        const curve = Curves.lissajous(e.r * 4, e.r * 4, 12, 17)

        for (let i = 0; i < bitCount; i++) {
            const angle = (i * T) / bitCount + theta / 2
            const bitPos = e.p.add(curve(angle))

            Ctx.polygon(ctx, 4, 1, bitPos, e.r / 3, WHITE, {
                theta: theta * 5,
                lineWidth: 1,
            })
        }
    }

    private drawRoundBits(ctx: CanvasRenderingContext2D, e: Enemy, theta: number): void {
        const bitCount = 7

        for (let i = 0; i < bitCount; i++) {
            const angle = (i * T) / bitCount + theta / 3
            const bitPos = e.p.add(vec.arg(angle).scale(e.r * 3.5))

            Ctx.polygon(ctx, 5, 1, bitPos, e.r / 3, CYAN, {
                theta: theta * 5,
                lineWidth: 1,
            })
        }
    }

    /**
     * 中心部の複雑な幾何学構造
     */
    private drawCoreComplex(ctx: CanvasRenderingContext2D, e: Enemy, theta: number, pulse: number): void {
        const coreColor = e.damaged ? RED : WHITE

        Ctx.polygon(ctx, 13, 2, e.p, e.r * (0.9 + pulse), coreColor, {
            theta: theta,
            lineWidth: 2,
        })
        Ctx.polygon(ctx, 11, 2, e.p, e.r * (0.9 - pulse), coreColor, {
            theta: -theta * 1.5,
            lineWidth: 1,
        })

        Ctx.arc(ctx, e.p, e.r * 0.7, WHITE, { lineWidth: 1 })
        Ctx.arc(ctx, e.p, e.r * 0.5, WHITE, { lineWidth: 1 })

        Ctx.polygon(ctx, 7, 2, e.p, e.r * (0.6 + pulse), coreColor, {
            theta: theta,
            lineWidth: 1,
        })
    }

    /**
     * 実際の当たり判定 (e.r) を示す円を描画
     */
    private drawHitBox(ctx: CanvasRenderingContext2D, e: Enemy, pulse: number): void {
        // 内側をうっすら塗り、周りの線の装飾と区別できる「面」にする
        Ctx.arc(ctx, e.p, e.r, HITBOX_FILL)
        // 縁は他のどの線よりも少しだけ太く明るくする
        Ctx.arc(ctx, e.p, e.r, HITBOX_EDGE, { lineWidth: 3 })
        // 鼓動するリングは縁の内側だけで動かし、当たり判定の外へはみ出させない
        Ctx.arc(ctx, e.p, e.r * (0.95 + pulse), WHITE, { lineWidth: 1 })
    }
}
