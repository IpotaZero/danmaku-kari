import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"

// ステージ「ウスバ」(砂塵道場・道場主)
// 道場主は、蟻地獄が羽化した姿のウスバ。二本の大顎・四本の脚・砂の詰まった腹を持ち、それぞれが別々の攻撃をする。
// 大顎: 外へ向けて吐いた砂の流れが、内側へ巻き込むように曲がる。左右の流れは自機の前で交差する。
// 脚: 砂をかき出す。速さのばらばらな砂粒が、散弾のように飛ぶ。
// 腹: 砂を高く噴き上げる。噴き上げられた砂は放物線を描いて、画面のあちこちに降ってくる。
// 胴: ときどき輪を放つ。大顎と腹を落とすと胴に攻撃が効くようになり、胴は渦を撒きはじめる。脚は落とさなくてもよいが、落とせば楽になる。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["のどがからから……。砂ばっかりだ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ようこそ、砂塵道場へ。私はウスバ。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["大顎と、この砂袋。まずはそこから崩してごらんなさい。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")

        const boss = new EnemyUsuba(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 大顎と腹が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.guards.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ふふ、砂を払うのが上手ね。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["もう口の中までじゃりじゃりだよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["砂塵道場の免状よ。持っていって。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyUsuba extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.45, this.game.HEIGHT * 0.07, 2, 3)

    // 大顎(左右)。胴の下で、開いたり閉じたりする
    private readonly jaws = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                24,
                (me) => vec(side * (40 + 12 * Math.sin(me.frame / 14)), 50),
                (me) => this.pincer(me, side),
                150 + (side > 0 ? 50 : 0),
            ),
    )

    // 腹。胴の上にある
    private readonly abdomen = new Part(
        this.game,
        this,
        600,
        30,
        (me) => vec(6 * Math.sin(me.frame / 30), -62),
        (me) => this.fountain(me),
        170,
    )

    // 脚(四本)。胴の両脇で、砂をかくように動く
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
                (me) => vec(side * (80 - row * 12) + side * 10 * Math.sin(me.frame / 10 + row), -10 + row * 36),
                (me) => this.kick(me, side),
                140 + row * 40 + (side > 0 ? 20 : 0),
            ),
    )

    // 落とさないと胴に攻撃が効かない部位
    readonly guards = [...this.jaws, this.abdomen]
    readonly parts = [...this.jaws, this.abdomen, ...this.legs]

    constructor(game: Game) {
        super(game, 2600, 48, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.body(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.17)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 380).add(this.home())
        yield
    }

    // 大顎の砂の流れ。外の斜め下へ吐き、内側へ巻き込むように曲がっていく
    private *pincer(me: Part, side: number) {
        for (let f = 0; f < 60; f += 3) {
            yield* remodel(me)
                .format("small-ball")
                .r(6)
                .color("#ffd890")
                .p(me.p.clone())
                .speed(4.5)
                .radian(T / 4 + side * 0.9)
                .g((b) => Behavior.rotating(b, -side * 0.018, 90))
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(140)
    }

    // 腹の噴水。上へ噴き上げた砂が、重さに引かれて放物線を描いて降る
    private *fountain(me: Part) {
        yield* remodel(me)
            .format("diamond")
            .color("#ffe8b8")
            .p(me.p.clone())
            .speed(5)
            .duplicate(14)
            .scatter({ radian: [-T / 4 - 0.7, -T / 4 + 0.7], speed: [3.5, 6.5] })
            .unbounded()
            .g(function* (b) {
                let v = vec.arg(b.radian).scale(b.speed)

                while (b.p.y < b.game.HEIGHT + 20) {
                    v = v.add(vec(0, 0.11))
                    b.radian = v.radian()
                    b.speed = v.magnitude()
                    yield
                }

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(90)
    }

    // 脚の砂かき。外寄りの下へ、速さのばらばらな砂粒を散弾のように
    private *kick(me: Part, side: number) {
        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#f0c878")
            .p(me.p.clone())
            .duplicate(8)
            .scatter({ radian: [T / 4 + side * 0.1 - 0.35, T / 4 + side * 0.1 + 0.35], speed: [3, 6.5] })
            .fire(this.game.bullets)

        yield* Array(80)
    }

    // 胴。守りの部位があるうちは、ときどき輪を放つ。守りがなくなると、四本腕の渦を撒く
    private *body() {
        if (this.guards.some((p) => p.life > 0)) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#fff0c0")
                .p(this.p.clone())
                .speed(3)
                .radian(this.random() * T)
                .ex(20)
                .fire(this.game.bullets)

            yield* Array(150)
            return
        }

        const base = this.random() * T
        for (let f = 0; f < 120; f += 4) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffc870")
                .p(this.p.clone())
                .speed(4.5)
                .radian(base + f * 0.045)
                .ex(4)
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(90)
    }
}
