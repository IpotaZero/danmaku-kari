import { Ctx } from "../../utils/Functions/Ctx"
import { vec } from "@ipota/vec"
import { Enemy } from "./Enemy"
import { IEnemyRenderer } from "./IEnemyRenderer"
import { DeathEffect } from "./DeathEffect"

const WHITE = "#ffffff80"
const RED = "rgba(255, 60, 60, 0.6)"
const BLACK_VALE = "rgba(255, 255, 255, 0.2)"
const BLUE = "rgba(60, 140, 255, 0.8)"
const CHARGE_FILL = "rgba(140, 200, 255, 0.95)"
const CHARGE_BG = "rgba(60, 140, 255, 0.2)"

export class EnemyRendererCore implements IEnemyRenderer {
    *onDead(e: Enemy) {
        yield* DeathEffect.explode(e)
    }

    draw(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const pulse = Math.sin(e.frame / 10) * 0.1 + 0.2
        const orbitTheta = e.frame / 60

        this.drawHpBar(ctx, e)
        this.drawOuterRing(ctx, e, orbitTheta)
        this.drawCore(ctx, e, pulse, orbitTheta)
        this.drawSatellites(ctx, e, orbitTheta)
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

    private drawOuterRing(ctx: CanvasRenderingContext2D, e: Enemy, orbitTheta: number): void {
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6 + orbitTheta / 2
            const p1 = e.p.add(vec(e.r * 1.4, 0).rotate(angle))
            const p2 = e.p.add(vec(e.r * 1.6, 0).rotate(angle))
            ctx.strokeStyle = BLACK_VALE
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
        }
    }

    private drawCore(ctx: CanvasRenderingContext2D, e: Enemy, pulse: number, orbitTheta: number): void {
        Ctx.polygon(ctx, 7, 2, e.p, e.r * (1.2 + pulse), BLACK_VALE, {
            theta: -orbitTheta,
            lineWidth: 2,
        })
        Ctx.arc(ctx, e.p, e.r, e.damaged ? RED : WHITE, { lineWidth: 1 })
        Ctx.arc(ctx, e.p, e.r * (1 + pulse), WHITE, { lineWidth: 1 })
        Ctx.polygon(ctx, 7, 2, e.p, e.r * 0.85, WHITE, {
            theta: orbitTheta,
            lineWidth: 1,
        })
    }

    private drawSatellites(ctx: CanvasRenderingContext2D, e: Enemy, orbitTheta: number): void {
        for (let i = 0; i < 3; i++) {
            const bitAngle = orbitTheta * 1.5 + (i * Math.PI * 2) / 3
            const bitPos = e.p.add(vec(e.r * 1.8, 0).rotate(bitAngle))
            Ctx.polygon(ctx, 4, 1, bitPos, 16, WHITE, { theta: bitAngle * 2 })
        }
    }
}
