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

// ステージ「カブト」(鉄壁道場・道場主)
// 道場主は大きなカブトムシ。角・左右の鞘翅・六本の脚を持ち、それぞれが別々の攻撃をする。
// 角: 自機へ向けて予告の線を引き、少しして線に沿って速い針の列を突き出す。
// 鞘翅: 胴の下を覆う大きな甲羅。胴を狙った弾をその身で受け止める。ゆっくりした大玉の輪を放つ。
// 脚: 前から順に、外寄りの下へ速くなる扇を撃つ。歩くように、波が前から後ろへ伝わる。
// 鞘翅を両方割ると、カブトは後翅を広げて飛び立つ。後翅は羽ばたくたびに速い扇を払い、胴に攻撃が効くようになって、胴は渦を撃ちはじめる。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["門も壁もかっちかち。どこから入るんだろう。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["正面からだ。我が鞘翅を割れるものなら割ってみよ。"], { name: "カブト" })
        this.hideFigure("hachinoko")

        const boss = new EnemyKabuto(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 鞘翅が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.elytra.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["むう……。見事に割られた。"], { name: "カブト" })
        yield* this.game.textBox.say(["飛んだのにはびっくりしたよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["はっはっは! 鉄壁道場の免状だ、受け取れ。"], { name: "カブト" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyKabuto extends Enemy {
    // 角。胴の真下に突き出している
    private readonly horn = new Part(
        this.game,
        this,
        700,
        22,
        () => vec(0, 78),
        (me) => this.thrust(me),
        160,
    )

    // 鞘翅(左右)。胴の下を覆う
    readonly elytra = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                700,
                40,
                () => vec(side * 40, 36),
                (me) => this.boulders(me),
                200 + (side > 0 ? 75 : 0),
            ),
    )

    // 脚(六本)。前脚・中脚・後脚が左右に一本ずつ。歩くように動く
    private readonly legs = [0, 1, 2].flatMap((row) =>
        [-1, 1].map(
            (side) =>
                new Part(
                    this.game,
                    this,
                    220,
                    16,
                    (me) => vec(side * (95 + 10 * (row % 2)) + side * 8 * Math.sin(me.frame / 9 + row), 45 - row * 35),
                    (me) => this.step(me, side, row),
                    150,
                ),
        ),
    )

    readonly parts = [this.horn, ...this.elytra, ...this.legs]

    constructor(game: Game) {
        super(game, 2800, 50, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.takeOff(), { margin: 120 })
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.walk(), { id: "move" })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    // 地上では、左右にのしのしと歩く
    private *walk() {
        const path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 2, 3)
        for (let f = 0; ; f++) {
            this.p = path(f / 260).add(this.home())
            yield
        }
    }

    // 飛び立った後は、大きく速く飛びまわる
    private *fly() {
        const path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.22, 2, 3)
        for (let f = 0; ; f++) {
            this.p = path(f / 150)
                .add(this.home())
                .add(vec(0, this.game.HEIGHT * 0.06))
            yield
        }
    }

    // 鞘翅が両方割れたら、後翅を広げて飛び立つ
    private *takeOff() {
        while (this.elytra.some((p) => p.life > 0)) yield

        this.game.camera.shake(8, 30)

        // 一度もとの位置へ戻ってから飛びまわる
        this.removeScript("move")
        yield* this.moveTo(this.home().add(vec(0, this.game.HEIGHT * 0.06)), 40)
        this.addScript(() => this.fly(), { id: "move" })

        const wings = [-1, 1].map(
            (side) =>
                new Part(
                    this.game,
                    this,
                    450,
                    30,
                    (me) => vec(side * (120 + 10 * Math.sin(me.frame / 6)), -15 - 25 * Math.sin(me.frame / 6)),
                    (me) => this.flap(me, side),
                    40 + (side > 0 ? 30 : 0),
                ),
        )
        this.game.enemies.push(...wings)

        this.addScript(() => this.whirl(), { loop: Infinity, margin: 60 })
    }

    // 角突き。自機へ向けて予告の線を引き、少しして線に沿って針の列を突き出す
    private *thrust(me: Part) {
        const start = me.p.clone()
        const radian = this.game.player.p.sub(start).radian()

        yield* remodel(me)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ffe0a0")
            .r(2)
            .speed(0)
            .p(start)
            .radian(radian)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.25, 10)
                yield* Array(25)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(35)

        yield* remodel(me)
            .format("line")
            .color("#ffe0a0")
            .p(start)
            .radian(radian)
            .speed(11)
            .duplicate(10)
            .delayByIndex(2)
            .fire(this.game.bullets)

        yield* Array(90)
    }

    // 鞘翅の大玉。ゆっくり出て、少しずつ速くなる
    private *boulders(me: Part) {
        yield* remodel(me)
            .format("big-ball")
            .color("#c8d4e8")
            .p(me.p.clone())
            .speed(1.5)
            .radian(this.random() * T)
            .ex(10)
            .g((b) => Behavior.accel(b, 60, 4))
            .fire(this.game.bullets)

        yield* Array(150)
    }

    // 脚の扇。前脚から順に撃つので、波が前から後ろへ伝わる。一巡(220フレーム)ごとに休む
    private *step(me: Part, side: number, row: number) {
        yield* Array(row * 18)

        yield* remodel(me)
            .format("diamond")
            .color("#9ab8ff")
            .p(me.p.clone())
            .speed(2)
            .radian(T / 4 + side * 0.45)
            .nway(3, T / 20)
            .g((b) => Behavior.ease(b, "speed", 6.5, 35, Ease.In))
            .fire(this.game.bullets)

        yield* Array(220 - row * 18)
    }

    // 後翅の羽ばたき。外寄りの下へ、速い扇を払う
    private *flap(me: Part, side: number) {
        yield* remodel(me)
            .format("diamond")
            .color("#d8e8ff")
            .p(me.p.clone())
            .speed(6)
            .radian(T / 4 + side * 0.7)
            .nway(9, T / 28)
            .fire(this.game.bullets)

        yield* Array(60)
    }

    // 飛び立った胴の渦。四本の腕がまわる
    private *whirl() {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 90; f += 5) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffffff")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * f * 0.05)
                .ex(4)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(80)
    }
}
