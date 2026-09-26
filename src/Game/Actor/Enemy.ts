import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Ease } from "@ipota/functions"
import { remodel } from "../Remodel"
import { T } from "../../T"
import { Game } from "../Game"

export abstract class Enemy extends Actor {
    private shakeP = vec(0, 0)
    private maxLife: number
    private frame = 0

    protected isBoss = false

    isInvincible = false

    constructor(game: Game, life: number, r: number) {
        super(game)
        this.life = life
        this.maxLife = life

        this.r = r
    }

    draw(ctx: CanvasRenderingContext2D) {}

    hit() {
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
        const r = 96
        const frame = 6

        for (let i = 1; i < frame + 1; i++) {
            this.r = r - r * Ease.Out(1 - i / frame) * 0.1
            yield
        }
    }

    private *shakeG() {
        const frame = 10

        for (let i = 1; i < frame + 1; i++) {
            this.shakeP.x = Math.sin(i) * Ease.Out(i / frame)
            this.shakeP.x = Math.cos(i * 2) * Ease.Out(i / frame)
            yield
        }
    }

    protected *moveTo(end: Vec, frame: number) {
        const start = this.p

        for (let i = 0; i < frame; i++) {
            this.p = start.add(end.sub(start).scale(Ease.Out(i / frame)))
            yield
        }
    }
}
