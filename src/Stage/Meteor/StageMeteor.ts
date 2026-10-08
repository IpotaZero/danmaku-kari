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
import { Charge } from "../Charge"

// ステージ「ホタル」(流星道場・道場主)
// 道場主は大きなホタル。光る尻(発光器)・二本の触角・まわりを飛ぶ八匹の子蛍を持ち、それぞれが別々の攻撃をする。
// 発光器: 自機へ向けて、発光器を通る三本の流れ星を流す。流れ星は画面の上の端から、発光器を抜けて駆け抜ける。
// 触角: 自機へ向けて、針を一列に突き出す。
// 子蛍: 胴のまわりの円を、そろってゆっくり回り、順に瞬く。瞬いた子蛍のまわりに光の粒が浮かび、一拍おいて輪になって散る。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ。
// 一段目: 発光器を落とすと次の段へ。胴はときどき輪を放つ。
// 蛍集め: 胴はまわりから光を集めて、四匹の大蛍を呼ぶ。大蛍のまわりには二匹ずつ孫蛍(孫機)が回り、孫蛍を落とすまで大蛍に攻撃が効かない。
// 二段目: 大蛍をすべて落とすと次の段へ。大蛍はゆっくり左右に揺れながら光の帯を残し、帯は少しして雨のように降る。孫蛍は小さな輪を放つ。
//         胴そのものが光りだし、胴を通る四本の流れ星を扇のように流す。
// 三段目: 最後の灯。胴に攻撃が効くようになり、自機を狙った三本の流れ星と、止まってから散る輪を交互に放つ。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["流れ星……じゃない、光る虫がいっぱいいる!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["流星道場へようこそ。わたしはホタル。"], { name: "ホタル" })
        yield* this.game.textBox.say(["わたしの光を消せたら、あなたの勝ち。"], { name: "ホタル" })
        this.hideFigure("hachinoko")

        const boss = new EnemyHotaru(this.game)
        this.game.enemies.push(boss, ...boss.parts)

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
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.08, 2, 3)

    // 発光器。胴の下でゆらゆら光る
    private readonly lantern = new Part(
        this.game,
        this,
        900,
        32,
        (me) => vec(0, 70 + 5 * Math.sin(me.frame / 30)),
        (me) => this.glow(me),
        150,
    )

    // 触角(左右)。胴の斜め上に伸びる。胴の真後ろに隠れないよう、胴の幅より外に出す
    private readonly antennae = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                350,
                16,
                (me) => vec(side * 64 + 4 * Math.sin(me.frame / 30), -46),
                (me) => this.needles(me),
                130 + (side > 0 ? 30 : 0),
            ),
    )

    // 子蛍(八匹)。胴のまわりの円を、等間隔のまま、そろってゆっくり回る
    private readonly fireflies = [0, 1, 2, 3, 4, 5, 6, 7].map(
        (i) =>
            new Part(
                this.game,
                this,
                200,
                14,
                (me) => vec.arg(me.frame / 120 + (T * i) / 8).scale(140),
                (me) => this.blink(me, i),
                160,
            ),
    )

    readonly parts = [this.lantern, ...this.antennae, ...this.fireflies]

    constructor(game: Game) {
        super(game, 1600, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

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
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        // 一段目: 発光器を落とすと次の段へ
        this.addScript(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.lantern.life > 0) yield

        // 蛍集め。光を集めてから、孫蛍(孫機)に守られた大蛍を呼ぶ
        this.removeScript("body")
        yield* Charge.gather(this, 150, "#d8ff90")
        this.game.camera.shake(8, 30)

        // 大蛍の持ち場。胴の両脇と、斜め下
        const bigs = [vec(-150, 10), vec(150, 10), vec(-80, 140), vec(80, 140)].map((slot, i) => {
            const big = new Part(
                this.game,
                this,
                280,
                18,
                (me) => slot.add(vec(40 * Math.sin(me.frame / 40 + i), 0)),
                (me) => this.trail(me),
                60 + i * 20,
            )
            const grandchildren = [0, 1].map(
                (k) =>
                    new Part(
                        this.game,
                        big,
                        90,
                        9,
                        (me) => vec.arg(me.frame / 30 + k * Math.PI).scale(28),
                        (me) => this.spark(me),
                        70 + k * 50,
                    ),
            )
            big.guardedBy(grandchildren)
            this.game.enemies.push(big, ...grandchildren)
            return big
        })

        // 二段目: 大蛍をすべて落とすと次の段へ。胴が光りだす
        this.addScript(() => this.meteorFan(), { loop: Infinity, margin: 60, id: "body" })
        while (bigs.some((p) => p.life > 0)) yield

        // 三段目: 最後の灯。胴に攻撃が効くようになる
        this.removeScript("body")
        this.isInvincible = false
        this.game.camera.shake(8, 30)
        this.addScript(() => this.lastLight(), { loop: Infinity, margin: 30, id: "body" })
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

    // 大蛍の光の帯。揺れながら通った跡に光を残し、残った光は少しして、そろって雨のように降る
    private *trail(me: Part) {
        for (let f = 0; f < 60; f += 4) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#e8ffb0")
                .p(me.p.clone())
                .speed(0)
                .radian(T / 4)
                .appear(10)
                .g(function* (b) {
                    yield* Array(80 - f)
                    yield* Behavior.accel(b, 30, 4.5)
                })
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(160)
    }

    // 孫蛍の火花。小さな輪
    private *spark(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(4)
            .color("#f0ffd0")
            .p(me.p.clone())
            .speed(3)
            .radian(this.random() * T)
            .ex(6)
            .fire(this.game.bullets)

        yield* Array(120)
    }

    // 一段目の胴。ときどき輪を放つ
    private *ring() {
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
    }

    // 光る胴の流れ星。胴を通る四本の流れ星を、扇のように流す
    private *meteorFan() {
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

        yield* Array(150)
    }

    // 最後の灯。自機を狙った三本の流れ星と、止まってから散る輪を交互に
    private *lastLight() {
        const aim = this.game.player.p.sub(this.p).radian()

        for (const k of [0, -1, 1]) {
            this.addScript(
                () =>
                    Meteor.fall(this, this.p.clone(), aim + k * 0.4, {
                        preview: 40,
                        speed: 18,
                        tailInterval: 2,
                        tailLife: 30,
                        color: "#ffffe0",
                    }),
                { margin: (k + 1) * 6 },
            )
        }

        yield* Array(60)

        yield* remodel(this)
            .format("diamond")
            .color("#ffffc0")
            .p(this.p.clone())
            .speed(5)
            .radian(this.random() * T)
            .ex(30)
            .g((b) => Behavior.reaccel(b, 20, 20, 30, 5.5))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
