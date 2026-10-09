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

// ステージ「チャンピオン」
// チャンピオンのまわりに子機が幾何学的に並ぶ。胴を囲む正方形に四枚の翅、胴の前の横一列に大顎の一対と毒針、胴の左右の横一列に六つの脚。
// そのまわりの大きな楕円を、六匹の働き蜂がそろって回る。それぞれが別々の攻撃をする。
// 大顎: 横へ開いた弾が一度止まり、自機のいた所へ一斉に噛みつく。左右の大顎が交互に噛みつく。
// 翅: 羽音。くねくねと揺れながら進む弾の列を、斜め下へ流す。
// 脚: 左の脚から右の脚へ順に、だんだん速くなる爪を落とす。爪が幕のように左から右へ降りていく。
// 毒針: 自機の方へ扇のように五本の線を薄く見せてから、端から順に線に沿って針を撃ち込む。
// 働き蜂: 大きな楕円を速く回り、進む向きへ短い弾の列を撃つ。
// 胴: 四枚の翅をすべて落とすまで攻撃が効かない。翅を落とすと、女王の怒り(向きを変えながら回る六本腕の渦)を撒きはじめる。
// 初雪: 胴の体力が半分を切ると、画面の上から初雪が降りはじめ、倒れるまで降り続ける。雪は当たり判定のある、ゆっくり揺れながら落ちる弾。
//       大顎や毒針を精密に避けている最中に、ばらばらな雪が混ざってくる。

export default class extends Stage {
    *G() {
        const boss = new EnemyHornet(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 翅が残っている間は、胴に攻撃が効かない
        while (boss.frame < 120 || boss.wings.some((p) => p.life > 0)) yield
        boss.isInvincible = false

        // 胴の体力が半分を切ると、初雪が降りはじめる。一年が冬へ戻っていく。降りはじめに画面の弾を蜜に変えて、一息つかせる
        while (boss.life > boss.maxLife / 2) yield
        this.scorenizeAllBullets()
        this.flash("#eef6ffc0", 40)
        boss.snow()

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()
        this.addScript(() => this.quietSnow(), { loop: Infinity })

        yield* Array(300)
    }

    // 戦いが終わったあとも降り続ける雪。当たり判定のない飾りなので、戦いの雪よりずっと小さく薄くして、弾と見分けがつくようにする
    private *quietSnow() {
        yield* remodel(this.game.player)
            .type("effect")
            .appearance("ball")
            .r(2)
            .color("#eef6ff")
            .alpha(0.3)
            .speed(1)
            .radian(T / 4)
            .p(vec(Math.random() * this.game.WIDTH, 0))
            .fire(this.game.bullets)

        yield* Array(8)
    }
}

class EnemyHornet extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.07, 2, 3)

    // 大顎(左右一対)。胴の前の横一列の両端
    private readonly mandibles = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                Size.L,
                () => vec(side * 85, 150),
                (me) => this.bite(me, side),
                140 + (side > 0 ? 60 : 0),
            ),
    )

    // 翅(四枚)。胴を囲む正方形の四つの角
    readonly wings = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
    ].map(
        ([side, row]) =>
            new Part(
                this.game,
                this,
                300,
                Size.M,
                () => vec(side * 71, row === 0 ? -71 : 71),
                (me) => this.buzz(me, side),
                150 + row * 40 + (side > 0 ? 20 : 0),
            ),
    )

    // 脚(六つ)。胴の左右に、横一列に三つずつ並ぶ
    private readonly legs = [-3, -2, -1, 1, 2, 3].map(
        (x, order) =>
            new Part(
                this.game,
                this,
                150,
                Size.S,
                () => vec(Math.sign(x) * (60 + 50 * Math.abs(x)), 20),
                (me) => this.claws(me, order),
                170,
            ),
    )

    // 毒針。胴の前の横一列の真ん中
    private readonly stinger = new Part(
        this.game,
        this,
        600,
        Size.L,
        () => vec(0, 150),
        (me) => this.sting(me),
        200,
    )

    // 働き蜂(六匹)。等間隔のまま、胴のまわりの大きな楕円をそろって回る
    private readonly workers = [0, 1, 2, 3, 4, 5].map(
        (i) =>
            new Part(
                this.game,
                this,
                180,
                Size.S,
                (me) => {
                    const angle = me.frame / 40 + (T * i) / 6
                    return vec(Math.cos(angle) * 180, Math.sin(angle) * 110)
                },
                (me) => this.patrol(me, i),
                130,
            ),
    )

    readonly parts = [...this.mandibles, ...this.wings, ...this.legs, this.stinger, ...this.workers]

    constructor(game: Game) {
        super(game, 4000, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.fury(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 180).add(this.home())
        yield
    }

    // 大顎の噛みつき。横へ開いた弾が一度止まり、少しして自機のいた所へ一斉に飛びかかる
    private *bite(me: Part, side: number) {
        yield* remodel(me)
            .format("diamond")
            .color("#ffd060")
            .p(me.p.clone())
            .speed(4)
            .radian(side > 0 ? 0.35 : Math.PI - 0.35)
            .nway(5, 0.25)
            .g(function* (b) {
                yield* Behavior.stop(b, 22)
                yield* Array(10)
                yield* Behavior.aim(b, this.game.player.p, 6)
                yield* Behavior.accel(b, 15, 8)
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }

    // 翅の羽音。くねくね揺れながら進む弾の列を、外寄りの斜め下へ流す
    private *buzz(me: Part, side: number) {
        for (let k = 0; k < 8; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#e8f0ff")
                .p(me.p.clone())
                .speed(4.5)
                .radian(T / 4 - side * 0.5)
                .g(function* (b) {
                    const base = b.radian
                    for (let f = 0; ; f++) {
                        b.radian = base + 0.6 * Math.sin(f / 5)
                        yield
                    }
                })
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(140)
    }

    // 脚の爪。左の脚から順に、だんだん速くなる三本の爪を落とす
    private *claws(me: Part, order: number) {
        yield* Array(order * 6)

        yield* remodel(me)
            .format("line")
            .color("#ffe0a0")
            .p(me.p.clone())
            .speed(3)
            .radian(T / 4)
            .nway(3, 0.18)
            .g((b) => Behavior.ease(b, "speed", 7, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(150 - order * 6)
    }

    // 毒針。扇のように五本の線を薄く見せてから、端から順に線に沿って針を撃ち込む
    private *sting(me: Part) {
        const start = me.p.clone()
        const aim = this.game.player.p.sub(start).radian()

        yield* remodel(me)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ff9060")
            .r(2)
            .speed(0)
            .p(start)
            .radian(aim)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .nway(5, 0.3)
            .g(function* (b, k) {
                yield* Behavior.ease(b, "alpha", 0.2, 8)
                yield* Array(22 + k * 10)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(30)

        for (let k = 0; k < 5; k++) {
            yield* remodel(me)
                .format("line")
                .color("#ff9060")
                .p(start)
                .radian(aim + (k - 2) * 0.3)
                .speed(11)
                .duplicate(6)
                .delayByIndex(2)
                .fire(this.game.bullets)
        }

        yield* Array(140)
    }

    // 働き蜂の見回り。i 番目の働き蜂は 8i フレーム待ってから、進む向きへ短い弾の列を撃つ
    private *patrol(me: Part, i: number) {
        yield* Array(i * 8)

        const before = me.p.clone()
        yield

        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#ffe890")
            .p(me.p.clone())
            .speed(5)
            .radian(me.p.sub(before).radian())
            .duplicate(3)
            .delayByIndex(4)
            .fire(this.game.bullets)

        yield* Array(70 - i * 8)
    }

    // 女王の怒り。翅があるうちは、ときどき輪を放つ。翅を落とすと、向きを変えながら回る六本腕の渦を撒く
    private *fury() {
        if (this.wings.some((p) => p.life > 0)) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#ffd060")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(20)
                .fire(this.game.bullets)

            yield* Array(170)
            return
        }

        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 80; f += 4) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffb040")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * 0.6 * Math.sin(f / 25))
                .ex(6)
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(70)
    }

    // 初雪。画面の上から、ゆっくり左右に揺れながら雪が降りはじめ、倒れるまで降り続ける
    snow() {
        this.addScript(() => this.snowfall(), { loop: Infinity })
    }

    private *snowfall() {
        yield* remodel(this)
            .format("small-ball")
            .color("#eef6ff")
            .speed(1.4)
            .duplicate(2, (b) => {
                b.p = vec(this.random() * this.game.WIDTH, 0)
                return b
            })
            .appear(20)
            .g(function* (b) {
                const phase = this.random() * T
                for (let f = 0; ; f++) {
                    b.radian = T / 4 + 0.35 * Math.sin(f / 40 + phase)
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(18)
    }
}
