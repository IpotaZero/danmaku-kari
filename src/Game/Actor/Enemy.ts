import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Ease } from "@ipota/functions"
import { Game } from "../Game"
import { IEnemyRenderer } from "./IEnemyRenderer"
import { EnemyRendererMob } from "./EnemyRendererMob"
import { seededRandom } from "../../utils/Functions/seededRandom"
import { Battery } from "./Battery"
import { IteratorQueue } from "../IteratorQueue"

export abstract class Enemy extends Actor {
    private readonly baseR: number

    maxLife: number
    frame = 0
    damaged = false

    // 充電。生まれたときにだけ決まり、生まれた瞬間から満ちるまで何もしない
    readonly battery: Battery

    // 親への追従や被弾で膨らむ見た目など、充電中も止まらない体の動き。
    // 外からは足せないので、ここに演出を入れて充電中に動かすことはできない
    private readonly figure = new IteratorQueue()

    readonly scripts = new EnemyScripts(this)

    isInvincible = false

    readonly renderer: IEnemyRenderer

    // 弾幕用の乱数のシード。n 体目の敵は、ステージに入り直すたびに同じシードになる
    readonly randomSeed = this.game.enemySeeds.next().value

    // 弾幕用の乱数。スクリプトや弾の挙動の実行中は、それ専用の乱数に差し替わる (withRandom を参照)
    random = seededRandom(this.randomSeed)

    constructor(
        game: Game,
        life: number,
        r: number,
        {
            renderer = new EnemyRendererMob(),
            charge = 0,
        }: {
            renderer?: IEnemyRenderer
            // 生まれてから充電にかけるフレーム数。充電はこの一度きりで、あとから始めることはできない
            charge?: number
        } = {},
    ) {
        super(game)
        this.p = vec(-100, -100)
        this.life = life
        this.maxLife = life

        this.r = r
        this.baseR = r

        this.renderer = renderer
        this.battery = new Battery(charge)
    }

    update(): void {
        this.figure.update()

        // 充電中は何もしない。どのスクリプトも止まるので、充電の間に動いたり演出したりはできない
        if (this.battery.isCharging()) this.battery.tick()
        else super.update()

        this.frame++
    }

    // iterable が1ステップ進む間だけ this.random を random に差し替える。
    // 乱数をジェネレータごとに持たせることで、ほかのジェネレータがいつ何回乱数を使っても値がずれない
    *withRandom(random: () => number, iterable: Iterable<unknown, unknown, void>) {
        const iterator = iterable[Symbol.iterator]()

        while (true) {
            const outer = this.random
            this.random = random
            const { done } = iterator.next()
            this.random = outer

            if (done) return
            yield
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.renderer.draw(ctx, this)
        this.damaged = false
    }

    // 弾は加算合成で描かれるので、密集すると白く飛んで敵の線が埋もれてしまう。
    // 本体の下だけ暗くして、弾が重なっても当たり判定の輪郭が読めるようにする。
    // 弾を隠しはせず減光にとどめる(見た目と当たり判定を乖離させない)
    drawShade(ctx: CanvasRenderingContext2D) {
        const gradient = ctx.createRadialGradient(this.p.x, this.p.y, 0, this.p.x, this.p.y, this.r * 1.5)
        gradient.addColorStop(0, "rgba(0, 0, 0, 0.6)")
        gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.6)")
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)")

        ctx.save()
        ctx.globalCompositeOperation = "source-over"
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(this.p.x, this.p.y, this.r * 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }

    hit(damage: number) {
        this.damaged = true
        // 自機の弾は毎フレーム何発も当たるので、当たるたびに膨らむ演出を積み増さず、同じidで最初からやり直す
        this.figure.add(() => this.hitG(), { id: "hit" })

        // 充電中は攻撃が効かず、そのぶん充電が早まる
        if (this.battery.absorb(damage)) return

        this.life -= damage
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

    protected *moveTo(end: Vec, frame: number, ratio: number = 1) {
        const start = this.p

        for (let i = 1; i < frame + 1; i++) {
            this.p = start.add(end.sub(start).scale(Ease.Out(i / frame) * ratio))
            yield
        }
    }

    // 親敵に追従する子敵として振る舞わせる。親が死んだら自分も死ぬ。
    // 登場の演出として、現れてから60フレームかけて、親の中心から position の位置まで広がり出る
    protected setParent(parent: Enemy, position: () => Vec) {
        this.figure.add(() => this.followParent(parent, position), { id: "parent", loop: Infinity })
    }

    private *followParent(parent: Enemy, position: () => Vec) {
        if (parent.life <= 0) {
            this.life = 0
            // ここでyieldせずreturnすると、addのloop:Infinityが
            // 一度もyieldしないまま呼び出しを回し続けてタブがフリーズする
            yield
            return
        }

        this.p = parent.p.add(position().scale(Ease.Out(Math.min(1, this.frame / 60))))
        yield
    }

    protected *randomMove(frames: number) {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        yield* this.moveTo(vec(w * (0.1 + 0.8 * this.random()), h * (0.1 + 0.1 * this.random())), frames)
    }
}

// 敵のスクリプト。スクリプトごとに乱数を初期化する。フェーズの長さやほかのスクリプトの消費量に関係なく、各スクリプトは毎回同じ列を使う
class EnemyScripts extends IteratorQueue {
    constructor(private readonly enemy: Enemy) {
        super()
    }

    add(g: () => Iterable<unknown, unknown, void>, config?: { loop?: number; margin?: number; id?: string }) {
        const random = seededRandom(this.enemy.randomSeed)
        super.add(() => this.enemy.withRandom(random, g()), config)
    }
}
