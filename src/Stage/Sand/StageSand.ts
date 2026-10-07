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

// ステージ「ウスバ」(砂塵道場・道場主)
// 道場主は、蟻地獄が羽化しかけたウスバ。二本の大顎・四本の脚・砂の詰まった腹を持ち、腹には三つの砂袋(孫機)がぶら下がっている。
// どの部位も一巡(330フレーム)の頭にまとめて攻撃し、残りの時間は静かになる。攻撃と休憩をはっきり分ける。
// 大顎: 外へ向けて吐いた砂の流れが、内側へ巻き込むように曲がる。左右の流れは自機の前で交差する。
// 脚: 砂をかき出す。速さのばらばらな砂粒が、散弾のように飛ぶ。
// 腹: 砂を高く噴き上げる。噴き上げられた砂は放物線を描いて、画面のあちこちに降ってくる。砂袋が残っている間は、腹に攻撃が効かない。
// 砂袋: 砂をこぼす。こぼれた砂は、だんだん速く真下へ落ちる。
// 一段目: 大顎と腹を落とすまで、胴に攻撃が効かない。胴はときどき輪を放つ。
// 二段目: すり鉢。自機のいる所とその近くに、砂の輪(すり鉢)が浮かび上がる。輪は真ん中へ縮んで、そのまま反対側へ抜けていく。輪の外へ逃げる。
// 三段目: 羽化。胴は羽化を始める(充電)。羽化している間は胴に攻撃が効かず、撃つほど早く羽化する。
//         羽化すると四枚の翅が生える。翅は砂の塊を落とし、塊は少し落ちてから扇に割れる。胴は六本腕の渦を撒く。
// 四段目: 砂嵐。すり鉢と渦を同時に使う。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["のどがからから……。砂ばっかりだ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ようこそ、砂塵道場へ。私はウスバ。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["大顎と、この砂袋。まずはそこから崩してごらんなさい。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")

        const boss = new EnemyUsuba(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ふふ、羽化しても敵わなかったわね。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["もう口の中までじゃりじゃりだよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["砂塵道場の免状よ。持っていって。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyUsuba extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 2, 3)

    // 大顎(左右)。胴の前で、開いたり閉じたりする
    private readonly jaws = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                24,
                (me) => vec(side * (60 + 14 * Math.sin(me.frame / 14)), 88),
                (me) => this.pincer(me, side),
                150,
            ),
    )

    // 腹。胴のうしろ(上)に伸びる
    private readonly abdomen = new Part(
        this.game,
        this,
        600,
        30,
        (me) => vec(8 * Math.sin(me.frame / 30), -95),
        (me) => this.fountain(me),
        150,
    )

    // 砂袋(三つ)。腹にぶら下がる孫機
    private readonly sandbags = [-1, 0, 1].map(
        (k) =>
            new Part(
                this.game,
                this.abdomen,
                150,
                13,
                (me) => vec.arg(-T / 4 + k * 0.8 + 0.1 * Math.sin(me.frame / 20)).scale(46),
                (me) => this.spill(me, k),
                150,
            ),
    )

    // 脚(四本)。胴の両脇から斜め前へ並び、砂をかくように上下する
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
                (me) => vec(side * (112 + 44 * row), 4 + 44 * row + 6 * Math.sin(me.frame / 10 + row * 2)),
                (me) => this.kick(me, side, row),
                150,
            ),
    )

    // 落とさないと胴に攻撃が効かない部位
    private readonly guards = [...this.jaws, this.abdomen]
    readonly parts = [...this.jaws, this.abdomen, ...this.sandbags, ...this.legs]

    constructor(game: Game) {
        super(game, 2600, 48, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.abdomen.isInvincible = true

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

    private *phases() {
        // 一段目: 大顎と腹が残っている間は、胴に攻撃が効かない。砂袋が残っている間は、腹に攻撃が効かない
        this.addScript(() => this.ring(), { loop: Infinity, margin: 150, id: "body" })

        while (this.guards.some((p) => p.life > 0)) {
            this.abdomen.isInvincible = this.sandbags.some((p) => p.life > 0)
            yield
        }

        this.isInvincible = false
        this.game.camera.shake(6, 20)

        // 二段目: すり鉢
        this.removeScript("body")
        yield* this.sync()
        this.addScript(() => this.pits(3), { loop: Infinity, id: "body" })

        while (this.life > this.maxLife * 0.6) yield

        // 三段目: 羽化。充電している間は攻撃が効かず、撃つほど早く羽化する
        this.removeScript("body")
        yield* this.battery.charge(240)
        this.game.camera.shake(10, 40)

        this.game.enemies.push(
            ...[
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
                        (me) => vec(side * (80 + 50 * row), -10 - 4 * row + 10 * Math.sin(me.frame / 7 + row)),
                        (me) => this.clods(me, side, row),
                        (330 - ((this.frame - 150) % 330)) % 330,
                    ),
            ),
        )

        yield* this.sync()
        this.addScript(() => this.whirl(), { loop: Infinity, id: "body" })

        while (this.life > this.maxLife * 0.25) yield

        // 四段目: 砂嵐。すり鉢と渦を同時に使う
        this.game.camera.shake(6, 20)
        yield* this.sync()
        this.addScript(() => this.pits(2), { loop: Infinity, id: "pits" })
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

    // すり鉢。自機のいる所と、画面の下の方のあちこちに、砂の輪が浮かび上がる。
    // 輪は浮かび上がってから真ん中へ縮み、そのまま反対側へ抜けて広がっていく
    private *pits(count: number) {
        for (let k = 0; k < count; k++) {
            const center =
                k === 0
                    ? this.game.player.p.clone()
                    : vec(
                          this.game.WIDTH * (0.15 + 0.7 * this.random()),
                          this.game.HEIGHT * (0.45 + 0.4 * this.random()),
                      )

            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffc870")
                .speed(0)
                .duplicate(20, (b, i) => {
                    b.p = center.add(vec.arg((T * i) / 20).scale(110))
                    b.radian = (T * i) / 20 + Math.PI
                    return b
                })
                .appear(30)
                .g(function* (b) {
                    yield* Array(30)
                    yield* Behavior.accel(b, 30, 3)
                })
                .fire(this.game.bullets)

            yield* Array(25)
        }

        yield* Array(330 - count * 25)
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
