import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Size } from "../Size"

// ステージ「カゲロウ」(霧隠道場・道場主)
// 道場主のまわりに子機が幾何学的に並ぶ。四枚の翅が胴を囲む正方形になってゆっくり回り、胴の下に三本の尾が横一列に並ぶ。
// それぞれが別々の攻撃をする。翅と尾をすべて落とすまで、胴には攻撃が効かない。
// 前翅: 外向きに扇を払う。正方形が回るので、扇の向きも少しずつ変わる。
// 後翅: 鱗粉を撒く。鱗粉はその場に漂ってから、ばらばらに落ちてくる。
// 尾: 細い霧の糸を垂らし、糸は左右に振れる。三本の糸が交差しながら画面を薙ぐ。
// 胴: 部位が減るほど、輪が濃くなっていく。すべての部位を落とすと、胴に攻撃が効くようになり、輪は止まってから散るようになる。

export default class extends Stage {
    *G() {
        const boss = new EnemyKagerou(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 翅と尾が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.parts.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyKagerou extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.08, 2, 3)

    // 前翅(二枚)。胴を囲む正方形の、向かい合う二つの角
    private readonly foreWings = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                380,
                Size.M,
                (me) => vec.arg(me.frame / 200 + (side > 0 ? 0 : Math.PI)).scale(100),
                (me) => this.gust(me),
                150 + (side > 0 ? 35 : 0),
            ),
    )

    // 後翅(二枚)。正方形の残りの二つの角
    private readonly hindWings = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                380,
                Size.M,
                (me) => vec.arg(me.frame / 200 + (side > 0 ? T / 4 : -T / 4)).scale(100),
                (me) => this.scales(me),
                180 + (side > 0 ? 30 : 0),
            ),
    )

    // 尾(三本)。胴の下に横一列に並ぶ
    private readonly tails = [-1, 0, 1].map(
        (k) =>
            new Part(
                this.game,
                this,
                300,
                Size.M,
                () => vec(k * 70, 150),
                (me) => this.thread(me, k),
                160 + (k + 1) * 25,
            ),
    )

    readonly parts = [...this.foreWings, ...this.hindWings, ...this.tails]

    constructor(game: Game) {
        super(game, 2400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.ring(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.17)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 350).add(this.home())
        yield
    }

    // 前翅の羽風。胴から見て外向きに、ゆっくり出て一気に速くなる扇を払う
    private *gust(me: Part) {
        yield* remodel(me)
            .format("diamond")
            .color("#e0e8ff")
            .p(me.p.clone())
            .speed(1.5)
            .radian(me.p.sub(this.p).radian())
            .nway(7, T / 30)
            .g((b) => Behavior.ease(b, "speed", 7, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }

    // 後翅の鱗粉。まわりに撒かれた粉はその場に漂い、少ししてからばらばらに落ちる
    private *scales(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#fff0d0")
            .p(me.p.clone())
            .speed(0)
            .duplicate(10)
            .scatter({ p: 40 })
            .appear(15)
            .g(function* (b) {
                yield* Array(30)
                b.radian = T / 4 + (this.random() - 0.5) * 0.8
                yield* Behavior.accel(b, 40, 2.5 + this.random() * 2)
            })
            .fire(this.game.bullets)

        yield* Array(60)
    }

    // 尾の霧の糸。左右へ振れながら、真下寄りに細い糸を垂らし続ける
    private *thread(me: Part, k: number) {
        for (let f = 0; f < 70; f += 4) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#c8d0f0")
                .p(me.p.clone())
                .speed(5.5)
                .radian(T / 4 + 0.6 * Math.sin(me.frame / 20 + k))
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(110)
    }

    // 胴の輪。部位が減るほど弾が増える。部位がなくなると、止まってから散る輪になり、間隔も短くなる
    private *ring() {
        const lost = this.parts.filter((p) => p.life <= 0).length
        const bare = lost === this.parts.length

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffb0d0")
            .p(this.p.clone())
            .speed(bare ? 5 : 3)
            .radian(this.random() * T)
            .ex(16 + lost * 4)
            .g((b) => (bare ? Behavior.reaccel(b, 20, 20, 30, 5.5) : Behavior.accel(b, 1, 3)))
            .fire(this.game.bullets)

        yield* Array(bare ? 60 : 120)
    }
}
