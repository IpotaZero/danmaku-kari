import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Ease } from "@ipota/functions"
import { Game } from "../Game"
import { IEnemyRenderer } from "./IEnemyRenderer"
import { EnemyRendererMob } from "./EnemyRendererMob"
import { seededRandom } from "../../utils/Functions/seededRandom"

export abstract class Enemy extends Actor {
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

    // 弾幕用の乱数。敵ごとに独立しているので、プレイヤーの行動やほかの敵の生死に関係なく、ステージに入り直すたびに同じ列になる
    readonly random = seededRandom(this.game.enemySeeds.next().value)

    constructor(
        game: Game,
        life: number,
        r: number,
        { renderer = new EnemyRendererMob() }: { renderer?: IEnemyRenderer } = {},
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
        this.renderer.draw(ctx, this)
        this.damaged = false
    }

    hit() {
        this.damaged = true
        this.addScript(this.hitG.bind(this))
    }

    *onDead(): Generator<void, void, void> {
        yield* this.renderer.onDead(this)
    }

    private *hitG() {
        const bump = this.baseR * 0.05
        const frame = 6

        for (let i = 1; i < frame + 1; i++) {
            this.r = this.baseR + bump * (1 - Ease.Out(i / frame))
            yield
        }

        this.r = this.baseR
    }

    protected *moveTo(end: Vec, frame: number) {
        const start = this.p

        for (let i = 0; i < frame; i++) {
            this.p = start.add(end.sub(start).scale(Ease.Out(i / frame)))
            yield
        }
    }

    // 親敵に追従する子敵として振る舞わせる。親が死んだら自分も死ぬ
    protected setParent(parent: Enemy, position: () => Vec) {
        this.addScript(() => this.followParent(parent, position), { id: "parent", loop: Infinity })
    }

    private *followParent(parent: Enemy, position: () => Vec) {
        if (parent.life <= 0) {
            this.life = 0
            // ここでyieldせずreturnすると、addScriptのloop:Infinityが
            // 一度もyieldしないまま呼び出しを回し続けてタブがフリーズする
            yield
            return
        }

        this.p = parent.p.add(position())
        yield
    }

    protected *randomMove(frames: number) {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        yield* this.moveTo(
            vec(w * (0.1 + 0.8 * this.random()), h * (0.1 + 0.1 * this.random())),
            frames,
        )
    }
}
