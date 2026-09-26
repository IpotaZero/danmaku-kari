import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Ease } from "@ipota/functions"
import { remodel } from "../Remodel"
import { T } from "../../T"
import { Game } from "../Game"
import { Ctx } from "../../utils/Functions/Ctx"

export abstract class Enemy extends Actor {
    private shakeP = vec(0, 0)
    private maxLife: number
    private readonly baseR: number
    private frame = 0
    private damaged = false

    protected isBoss = false

    isInvincible = false

    constructor(game: Game, life: number, r: number) {
        super(game)
        this.life = life
        this.maxLife = life

        this.r = r
        this.baseR = r
    }

    update(): void {
        super.update()
        this.frame++
    }

    draw(ctx: CanvasRenderingContext2D) {
        const drawP = this.p.add(this.shakeP)
        const pulse = 1 + Math.sin(this.frame / 12) * 0.05
        const color = this.damaged ? "rgba(255, 90, 90, 0.9)" : "#ffffffc0"

        this.drawHpBar(ctx)

        Ctx.arc(ctx, drawP, this.r * pulse, color, { lineWidth: 2 })
        Ctx.polygon(ctx, 6, 1, drawP, this.r * 0.75 * pulse, color, {
            theta: this.frame / 40,
            lineWidth: 2,
        })
        Ctx.arc(ctx, drawP, this.r * 0.3, this.isInvincible ? "rgba(255, 220, 80, 0.9)" : "rgba(255, 255, 255, 0.6)", {
            lineWidth: 0,
        })

        this.damaged = false
    }

    private drawHpBar(ctx: CanvasRenderingContext2D) {
        const barW = this.r * 2.4
        const barH = 6
        const barPos = this.p.add(vec(-barW / 2, -this.r - 20))
        const hpRatio = Math.max(0, this.life / this.maxLife)
        const mainColor = this.damaged ? "rgba(255, 90, 90, 0.9)" : "#ffffffc0"

        Ctx.rect(ctx, barPos.l, [barW, barH], "rgba(255, 255, 255, 0.15)", { lineWidth: 1 })
        Ctx.rect(ctx, barPos.l, [barW * hpRatio, barH], mainColor)
    }

    hit() {
        this.damaged = true
        this.addScript(this.hitG.bind(this))
        this.addScript(this.shakeG.bind(this))
    }

    *onDead(): Generator<void, void, void> {
        yield* remodel(this)
            .type("effect")
            .alpha(0.5)
            .p(this.p.clone())
            .duplicate(63, (me, i) => {
                me.radian = Math.random() * T
                me.speed = Math.random() * 4 + 4
                return me
            })
            .g(function* (me) {
                const frame = 60
                for (let i = 1; i < frame + 1; i++) {
                    me.alpha = 0.5 * (1 - i / frame)
                    yield
                }
                me.life = 0
            })
            .fire(this.game.bullets)
    }

    private *hitG() {
        const bump = this.baseR * 0.15
        const frame = 6

        for (let i = 1; i < frame + 1; i++) {
            this.r = this.baseR + bump * (1 - Ease.Out(i / frame))
            yield
        }

        this.r = this.baseR
    }

    private *shakeG() {
        const frame = 10

        for (let i = 1; i < frame + 1; i++) {
            const attenuation = 1 - Ease.Out(i / frame)
            this.shakeP.x = Math.sin(i) * attenuation
            this.shakeP.y = Math.cos(i * 2) * attenuation
            yield
        }

        this.shakeP = vec(0, 0)
    }

    protected *moveTo(end: Vec, frame: number) {
        const start = this.p

        for (let i = 0; i < frame; i++) {
            this.p = start.add(end.sub(start).scale(Ease.Out(i / frame)))
            yield
        }
    }
}
