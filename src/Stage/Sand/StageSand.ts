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
import { Charge } from "../Charge"

// ステージ「ウスバ」(砂塵道場・道場主)
// 道場主のまわりに子機が幾何学的に並ぶ。胴の前に大顎の一対、胴の上に腹、胴の左右に脚の横一列。腹のまわりを三つの砂袋(孫機)が回る。
// どの部位も一巡(330フレーム)の頭にまとめて攻撃し、残りの時間は静かになる。攻撃と休憩をはっきり分ける。
// 大顎: 外へ向けて吐いた砂の流れが、内側へ巻き込むように曲がる。左右の流れは自機の前で交差する。
// 脚: 砂をかき出す。速さのばらばらな砂粒が、散弾のように飛ぶ。
// 腹: 砂を高く噴き上げる。噴き上げられた砂は放物線を描いて、画面のあちこちに降ってくる。砂袋が残っている間は、腹に攻撃が効かない。
// 砂袋: 砂をこぼす。こぼれた砂は、だんだん速く真下へ落ちる。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ。
// 一段目: 大顎と腹を落とすと次の段へ。胴はときどき輪を放つ。
// 羽化: 胴はまわりの砂を吸い込んで力を溜め、胴を囲む正方形に四枚の翅を出す。
// 二段目: 翅を落とすと次の段へ。翅は砂の塊を落とし、塊は少し落ちてから扇に割れる。
//         胴は砂の帳を下ろす。左右に大きく広がった砂が止まり、そろって真下へ落ちる。二度目の砂は一度目の筋の間に落ちる。
// 三段目: 砂嵐。胴に攻撃が効くようになり、六本腕の渦と砂の帳を同時に使う。

export default class extends Stage {
    *G() {
        const boss = new EnemyUsuba(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyUsuba extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 2, 3)

    // 大顎(左右)。胴の前に並ぶ
    private readonly jaws = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                24,
                () => vec(side * 64, 88),
                (me) => this.pincer(me, side),
                150,
            ),
    )

    // 腹。胴の上にある
    private readonly abdomen = new Part(
        this.game,
        this,
        600,
        30,
        () => vec(0, -95),
        (me) => this.fountain(me),
        150,
    )

    // 砂袋(三つ)。腹のまわりの円を、等間隔のままゆっくり回る孫機
    private readonly sandbags = [-1, 0, 1].map(
        (k) =>
            new Part(
                this.game,
                this.abdomen,
                150,
                13,
                (me) => vec.arg(me.frame / 120 + (T * (k + 1)) / 3).scale(46),
                (me) => this.spill(me, k),
                150,
            ),
    )

    // 脚(四つ)。胴の左右に、横一列に並ぶ
    private readonly legs = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
    ].map(
        ([side, row]) =>
            new Part(
                this.game,
                this,
                260,
                16,
                () => vec(side * (110 + 45 * row), 20),
                (me) => this.kick(me, side, row),
                150,
            ),
    )

    // 落とさないと胴に攻撃が効かない部位
    private readonly guards = [...this.jaws, this.abdomen]
    readonly parts = [...this.jaws, this.abdomen, ...this.sandbags, ...this.legs]

    constructor(game: Game) {
        super(game, 1600, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.abdomen.guardedBy(this.sandbags)

        this.addScript(() => this.enter())
        this.addScript(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 240).add(this.home())
        yield
    }

    // 一巡(330フレーム)の頭まで待つ。胴の攻撃を部位の攻撃とそろえて、攻撃と休憩をはっきり分ける
    private *sync() {
        yield* Array((330 - ((this.frame - 150) % 330)) % 330)
    }

    // 次の一巡の頭までのフレーム数。子機が広がり終わる(60フレーム)前には撃たないよう、近すぎるときはさらに次の巡の頭まで
    private untilNextCycle() {
        const rest = (330 - ((this.frame - 150) % 330)) % 330
        return rest < 60 ? rest + 330 : rest
    }

    private *phases() {
        // 一段目: 大顎と腹を落とすと次の段へ
        this.addScript(() => this.ring(), { loop: Infinity, margin: 150, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        // 羽化。砂を吸い込んで力を溜めてから、胴を囲む正方形に四枚の翅を出す
        this.removeScript("body")
        yield* Charge.gather(this, 150, "#ffd890")

        const wings = [
            [-1, 0],
            [1, 0],
            [-1, 1],
            [1, 1],
        ].map(
            ([side, row]) =>
                new Part(
                    this.game,
                    this,
                    250,
                    24,
                    () => vec(side * 78, row === 0 ? -78 : 78),
                    (me) => this.clods(me, side, row),
                    this.untilNextCycle(),
                ),
        )
        this.game.enemies.push(...wings)

        // 二段目: 翅を落とすと次の段へ。胴は砂の帳を下ろす
        yield* this.sync()
        this.addScript(() => this.curtain(), { loop: Infinity, id: "body" })
        while (wings.some((p) => p.life > 0)) yield

        // 三段目: 砂嵐。胴に攻撃が効くようになり、渦と砂の帳を同時に使う
        this.isInvincible = false
        this.game.camera.shake(8, 30)
        yield* this.sync()
        this.addScript(() => this.whirl(), { loop: Infinity, id: "whirl" })
    }

    // 大顎の砂の流れ。外の斜め下へ吐き、内側へ巻き込むように曲がっていく
    private *pincer(me: Part, side: number) {
        yield* Array(side > 0 ? 20 : 0)

        for (let f = 0; f < 60; f += 3) {
            yield* remodel(me)
                .format("small-ball")
                .r(6)
                .color("#ffd890")
                .p(me.p.clone())
                .speed(5)
                .radian(T / 4 + side * 0.9)
                .g((b) => Behavior.rotating(b, -side * 0.02, 80))
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(270 - (side > 0 ? 20 : 0))
    }

    // 腹の噴水。上へ噴き上げた砂が、重さに引かれて放物線を描いて降る
    private *fountain(me: Part) {
        yield* Array(40)

        yield* remodel(me)
            .format("diamond")
            .color("#ffe8b8")
            .p(me.p.clone())
            .speed(5)
            .duplicate(16)
            .scatter({ radian: [-T / 4 - 0.7, -T / 4 + 0.7], speed: [3.5, 6.5] })
            .unbounded()
            .g(function* (b) {
                let v = vec.arg(b.radian).scale(b.speed)

                while (b.p.y < b.game.HEIGHT + 20) {
                    v = v.add(vec(0, 0.13))
                    b.radian = v.radian()
                    b.speed = v.magnitude()
                    yield
                }

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(290)
    }

    // 砂袋のこぼれ砂。k 番目の砂袋は少しずつ遅れて、だんだん速く真下へ落ちる砂をこぼす
    private *spill(me: Part, k: number) {
        yield* Array(60 + (k + 1) * 12)

        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#fff0c0")
            .p(me.p.clone())
            .speed(0.5)
            .radian(T / 4)
            .duplicate(3)
            .delayByIndex(6)
            .nway(3, 0.25)
            .g((b) => Behavior.ease(b, "speed", 6, 60, Ease.In))
            .fire(this.game.bullets)

        yield* Array(330 - 60 - (k + 1) * 12 - 12)
    }

    // 脚の砂かき。外寄りの下へ、速さのばらばらな砂粒を散弾のように
    private *kick(me: Part, side: number, row: number) {
        yield* Array(30 + row * 30)

        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#f0c878")
            .p(me.p.clone())
            .duplicate(10)
            .scatter({ radian: [T / 4 + side * 0.15 - 0.35, T / 4 + side * 0.15 + 0.35], speed: [3.5, 7] })
            .fire(this.game.bullets)

        yield* Array(300 - row * 30)
    }

    // 一段目の胴。ときどき輪を放つ
    private *ring() {
        yield* Array(100)

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#fff0c0")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(20)
            .fire(this.game.bullets)

        yield* Array(230)
    }

    // 砂の帳。左右に大きく広がった砂が止まり、そろって真下へ落ちる。
    // 二度目の砂は、一度目の筋と筋の間に落ちるようにずらして撒く。筋の間を抜けたら、半歩ずれてもう一度抜ける
    private *curtain() {
        const base = (this.random() - 0.5) * 0.3

        for (let k = 0; k < 2; k++) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffc870")
                .p(this.p.clone())
                .speed(6)
                .radian(T / 4 + base + k * 0.125)
                .nway(11, 0.25)
                .g(function* (b) {
                    yield* Behavior.stop(b, 45)
                    yield* Array(15)
                    b.radian = T / 4
                    yield* Behavior.accel(b, 40, 5)
                })
                .fire(this.game.bullets)
            yield* Array(30)
        }

        yield* Array(270)
    }

    // 羽化した胴の渦。六本の腕が、少しずつ向きを変えながら回る
    private *whirl() {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 90; f += 5) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffc870")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * f * 0.035)
                .ex(6)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(240)
    }

    // 翅の砂の塊。外寄りの斜め下へ落とした塊が、少しして扇に割れる
    private *clods(me: Part, side: number, row: number) {
        yield* Array(row * 30)

        yield* remodel(me)
            .format("big-ball")
            .color("#ffe0a0")
            .p(me.p.clone())
            .speed(3)
            .radian(T / 4 + side * 0.5)
            .g(function* (b) {
                yield* Array(35)

                yield* remodel(this)
                    .format("small-ball")
                    .r(5)
                    .color("#ffe8c0")
                    .p(b.p.clone())
                    .speed(5)
                    .radian(b.radian)
                    .nway(5, 0.3)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(330 - row * 30)
    }
}
