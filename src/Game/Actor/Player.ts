import { Actor } from "./Actor"
import { Game } from "../Game"
import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"

export class Player extends Actor {
    readonly GRAZE_R = 16

    override readonly r: number = 2

    private readonly maxLife = 8
    private frame = 0

    // クールダウンはジェネレータ内で保持
    private isInvincibleBecauseOfHit = false

    constructor(game: Game, startPosition: Vec) {
        super(game)
        this.p = startPosition
        this.life = this.maxLife
    }

    update(): void {
        super.update()
        this.frame++
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save()
        ctx.globalAlpha = this.isInvincible() ? 0.5 : 1

        this.drawLife(ctx)
        this.drawGrazeBoundary(ctx)
        this.drawCore(ctx)

        ctx.restore()
    }

    isInvincible() {
        return this.isInvincibleBecauseOfHit
    }

    private drawCore(ctx: CanvasRenderingContext2D) {
        Ctx.arc(ctx, this.p, this.r, "red", { lineWidth: 0 })
    }

    private drawGrazeBoundary(ctx: CanvasRenderingContext2D) {
        Ctx.arc(ctx, this.p, this.GRAZE_R, "#ffffff60", { lineWidth: 2 })
        Ctx.polygon(ctx, 8, 2, this.p, this.GRAZE_R * 2.5, "#ffffff40", {
            theta: -this.frame / 48,
            lineWidth: 1,
        })
    }

    private drawLife(ctx: CanvasRenderingContext2D) {
        for (let i = 0; i < this.life; i++) {
            const center = this.p.add(vec(this.GRAZE_R * 3.5, 0).rotate(T * (i / this.maxLife) + this.frame / 60))
            Ctx.polygon(ctx, 4, 1, center, this.GRAZE_R, "#ffffff80", { theta: this.frame / 60, lineWidth: 1 })
        }
    }
}
