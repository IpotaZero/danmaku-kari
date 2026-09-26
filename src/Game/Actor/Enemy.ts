import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Ease } from "@ipota/functions"
import { remodel } from "../Remodel"
import { T } from "../../T"
import { Game } from "../Game"
import { IEnemyRenderer } from "./IEnemyRenderer"
import { EnemyRendererMob } from "./EnemyRendererMob"

export abstract class Enemy extends Actor {
    private shakeP = vec(0, 0)
    private readonly baseR: number

    maxLife: number
    frame = 0
    damaged = false

    // 充電攻撃を行わない敵では常に0のまま。レンダラーはこれを見てHPバー/充電バーを切り替える
    chargeRemaining = 0
    chargeMax = 0

    protected isBoss = false

    isInvincible = false

    readonly renderer: IEnemyRenderer

    constructor(
        game: Game,
        life: number,
        r: number,
        { renderer = new EnemyRendererMob() }: { renderer?: IEnemyRenderer },
    ) {
        super(game)
        this.p = vec(-100, -100)
        this.life = life
        this.maxLife = life

        this.r = r
        this.baseR = r

        this.renderer = renderer
    }

    update(): void {
        super.update()
        this.frame++
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save()
        ctx.translate(this.shakeP.x, this.shakeP.y)
        this.renderer.draw(ctx, this)
        ctx.restore()

        this.damaged = false
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
