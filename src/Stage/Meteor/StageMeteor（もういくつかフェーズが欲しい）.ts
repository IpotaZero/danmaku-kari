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
import { Meteor } from "./Meteor"

// ステージ「ホタル」(流星道場・道場主)
// 道場主は大きなホタル。光る尻(発光器)・二本の触角・まわりを飛ぶ八匹の子蛍を持ち、それぞれが別々の攻撃をする。
// 発光器: 自機へ向けて、発光器を通る三本の流れ星を流す。流れ星は画面の上の端から、発光器を抜けて駆け抜ける。
// 触角: 自機へ向けて、針を一列に突き出す。
// 子蛍: 胴のまわりを速く回り、順に瞬く。瞬いた子蛍のまわりに光の粒が浮かび、一拍おいて輪になって散る。
// 胴: 発光器を落とすまで攻撃が効かない。発光器を落とすと、胴そのものが光りだし、胴を通る四本の流れ星を扇のように流しはじめる。
// 子蛍と触角は落とさなくてもよいが、落とすほど楽になる。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["流れ星……じゃない、光る虫がいっぱいいる!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["流星道場へようこそ。わたしはホタル。"], { name: "ホタル" })
        yield* this.game.textBox.say(["わたしの光を消せたら、あなたの勝ち。"], { name: "ホタル" })
        this.hideFigure("hachinoko")

        const boss = new EnemyHotaru(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 発光器が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.lantern.life > 0
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["あらら、真っ暗。"], { name: "ホタル" })
        yield* this.game.textBox.say(["目がちかちかするよ……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["流星道場の免状、持っていって。"], { name: "ホタル" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyHotaru extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.35, this.game.HEIGHT * 0.08, 2, 3)

    // 発光器。胴の下でゆらゆら光る
    readonly lantern = new Part(
        this.game,
        this,
        900,
        32,
        (me) => vec(0, 70 + 6 * Math.sin(me.frame / 12)),
        (me) => this.glow(me),
        150,
    )

    // 触角(左右)
    private readonly antennae = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                350,
                16,
                (me) => vec(side * (30 + 4 * Math.sin(me.frame / 7)), -60),
                (me) => this.needles(me),
                130 + (side > 0 ? 30 : 0),
            ),
    )

    // 子蛍(八匹)。胴のまわりを速く回る
    private readonly fireflies = [0, 1, 2, 3, 4, 5, 6, 7].map(
        (i) =>
            new Part(
                this.game,
                this,
                200,
                14,
                (me) => vec.arg(me.frame / 50 + (T * i) / 8).scale(130 + 20 * Math.sin(me.frame / 20 + i)),
                (me) => this.blink(me, i),
                160,
            ),
    )

    readonly parts = [this.lantern, ...this.antennae, ...this.fireflies]

    constructor(game: Game) {
        super(game, 3000, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.shine(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    // 発光器の流れ星。自機を狙った線と、その両脇の線の三本。どれも発光器を通る
    private *glow(me: Part) {
        const aim = this.game.player.p.sub(me.p).radian()

        for (const k of [0, -1, 1]) {
            me.addScript(
                () =>
                    Meteor.fall(me, me.p.clone(), aim + k * 0.45, {
                        preview: 45,
                        speed: 16,
                        tailInterval: 2,
                        tailLife: 36,
                        color: "#d8ff90",
                    }),
                { margin: (k + 1) * 8 },
            )
        }

        yield* Array(170)
    }

    // 触角の針。自機へ向けて一列に、だんだん速く
    private *needles(me: Part) {
        yield* remodel(me)
            .format("line")
            .color("#f0ffc0")
            .p(me.p.clone())
            .speed(2)
            .aim(this.game.player)
            .duplicate(5)
            .delayByIndex(4)
            .g((b) => Behavior.ease(b, "speed", 8, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(60)
    }

    // 子蛍の瞬き。i 番目の子蛍は 10i フレーム待ってから瞬く。まわりに浮かんだ光の粒は、一拍おいて輪になって散る
    private *blink(me: Part, i: number) {
        yield* Array(i * 10)

        yield* remodel(me)
            .format("small-ball")
            .r(6)
            .color("#d8ff90")
            .p(me.p.clone())
            .speed(0)
            .radian(this.random() * T)
            .ex(7)
            .forEach((b) => {
                b.p = b.p.add(vec.arg(b.radian).scale(14))
            })
            .appear(10)
            .g(function* (b) {
                yield* Array(25)
                yield* Behavior.accel(b, 20, 5.5)
            })
            .fire(this.game.bullets)

        yield* Array(240 - i * 10)
    }

    // 胴の光。発光器があるうちは、ときどき輪を放つだけ。発光器を落とすと、胴を通る四本の流れ星を扇のように流す
    private *shine() {
        if (this.lantern.life > 0) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#ffffc0")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(20)
                .fire(this.game.bullets)

            yield* Array(160)
            return
        }

        const sway = (this.random() - 0.5) * 0.6

        for (const k of [0, 1, 2, 3]) {
            this.addScript(
                () =>
                    Meteor.fall(this, this.p.clone(), T / 4 + sway + (k - 1.5) * 0.5, {
                        preview: 40,
                        speed: 16,
                        tailInterval: 2,
                        tailLife: 36,
                        color: "#ffffc0",
                    }),
                { margin: k * 6 },
            )
        }

        yield* Array(130)
    }
}
