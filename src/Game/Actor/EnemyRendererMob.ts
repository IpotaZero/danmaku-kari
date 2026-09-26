import { Ctx } from "../../utils/Functions/Ctx"
import { vec } from "@ipota/vec"
import { Enemy } from "./Enemy"
import { IEnemyRenderer } from "./IEnemyRenderer"

const WHITE = "#ffffff80"
const RED = "rgba(255, 60, 60, 0.6)"
const BLACK_VALE = "rgba(255, 255, 255, 0.2)"
const BLUE = "rgba(60, 140, 255, 0.8)"
const CHARGE_FILL = "rgba(140, 200, 255, 0.95)"
const CHARGE_BG = "rgba(60, 140, 255, 0.2)"

export class EnemyRendererMob implements IEnemyRenderer {
    draw(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const orbitTheta = e.frame / 30

        this.drawHpBar(ctx, e)
        this.drawCore(ctx, e, orbitTheta)
    }

    private drawHpBar(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const isCharging = e.chargeRemaining > 0
        const barW = e.r * 3
        const barH = 6
        const barPos = e.p.add(vec(-barW / 2, -e.r - 24))

        if (isCharging && e.chargeMax > 0) {
            // 充電中はHPバーを隠し、充電進捗バーのみ表示
            const chargeRatio = 1 - e.chargeRemaining / e.chargeMax

            Ctx.rect(ctx, barPos, vec(barW, barH), CHARGE_BG, { lineWidth: 1 })
            Ctx.rect(ctx, barPos, vec(barW * chargeRatio, barH), CHARGE_FILL)

            for (let i = 1; i < 5; i++) {
                const x = barPos.x + (barW / 5) * i
                ctx.lineWidth = 2
                ctx.strokeStyle = BLUE
                ctx.beginPath()
                ctx.moveTo(x, barPos.y)
                ctx.lineTo(x, barPos.y + barH)
                ctx.stroke()
            }
        } else {
            // 通常時はHPバーを表示
            const mainColor = e.damaged || e.isInvincible ? RED : WHITE
            const hpRatio = e.life / e.maxLife

            Ctx.rect(ctx, barPos, vec(barW, barH), BLACK_VALE, { lineWidth: 1 })
            Ctx.rect(ctx, barPos, vec(barW * hpRatio, barH), mainColor)

            for (let i = 1; i < 5; i++) {
                const x = barPos.x + (barW / 5) * i
                ctx.lineWidth = 2
                ctx.strokeStyle = BLACK_VALE
                ctx.beginPath()
                ctx.moveTo(x, barPos.y)
                ctx.lineTo(x, barPos.y + barH)
                ctx.stroke()
            }
        }
    }

    private drawCore(ctx: CanvasRenderingContext2D, e: Enemy, orbitTheta: number): void {
        Ctx.arc(ctx, e.p, e.r * 1.1, WHITE, {
            lineWidth: 2,
        })
        Ctx.arc(ctx, e.p, e.r, e.damaged ? RED : WHITE, { lineWidth: 2 })
        Ctx.polygon(ctx, 5, 1, e.p, e.r * 0.85, WHITE, {
            theta: orbitTheta,
            lineWidth: 2,
        })
    }
}
