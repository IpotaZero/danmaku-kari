import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"

// ステージ「スズムシ」(月影道場・道場主)
// 道場主は大きなスズムシ。鳴らす二枚の翅・二本の長い触角・胴の下に吊るした六つの鈴を持ち、それぞれが別々の攻撃をする。
// 翅: 擦り合わせて音を鳴らす。左右の翅から同時に半円の波が広がり、二つの波が重なって格子のような隙間ができる。
// 触角: 探るように弾を撒き、少しして自機の方へ向きを変えて飛ばす。
// 鈴: 振り子のように揺れながら、順に鈴玉を落とす。鈴玉は少し落ちてから、輪になって鳴り響く。
// 胴: 翅を両方落とすまで攻撃が効かない。翅を落とすと、月の輪(一度広がって止まり、くるりと回ってから散る輪)を放ちはじめる。
// 鈴は胴の下にぶら下がっているので、胴を撃とうとすると鈴に当たる。鈴を落とすと胴の下が開ける。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["月が明るい……どこからか、鈴の音が。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["リーン……。月影道場へ、ようこそ。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["音の波の隙間を、くぐり抜けてごらんなさい。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")

        const boss = new EnemySuzumushi(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 翅が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.wings.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……もう、鳴らせませんね。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["耳の奥でまだリンリン言ってる……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["月影道場の免状です。お持ちなさい。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemySuzumushi extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.35, this.game.HEIGHT * 0.07, 2, 3)

    // 翅(左右)。細かく震えて音を鳴らす
    readonly wings = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                700,
                34,
                (me) => vec(side * (50 + 3 * Math.sin(me.frame * 1.3)), -14),
                (me) => this.chirp(me, side),
                150,
            ),
    )

    // 触角(左右)。胴の上へ長く伸びて、ゆらゆら揺れる
    private readonly antennae = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                300,
                14,
                (me) => vec(side * (95 + 12 * Math.sin(me.frame / 16)), -95 + 10 * Math.cos(me.frame / 16)),
                (me) => this.probe(me, side),
                130 + (side > 0 ? 35 : 0),
            ),
    )

    // 鈴(六つ)。胴の下に、長さの違う糸で吊るされて振り子のように揺れる
    private readonly bells = [0, 1, 2, 3, 4, 5].map(
        (k) =>
            new Part(
                this.game,
                this,
                180,
                14,
                (me) => {
                    const swing = 0.4 * Math.sin(me.frame / 22 + k)
                    return vec((k - 2.5) * 40, 30).add(vec(Math.sin(swing), Math.cos(swing)).scale(55 + 22 * (k % 3)))
                },
                (me) => this.bell(me, k),
                170,
            ),
    )

    readonly parts = [...this.wings, ...this.antennae, ...this.bells]

    constructor(game: Game) {
        super(game, 2800, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.moonRing(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    // 翅の音。下向きの半円の波を三つ続けて広げる。右の翅は少し遅れるので、左右の波がずれて重なる
    private *chirp(me: Part, side: number) {
        yield* Array(side > 0 ? 6 : 0)

        for (let k = 0; k < 3; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#fff0b0")
                .p(me.p.clone())
                .speed(4)
                .radian(T / 4)
                .nway(17, T / 2 / 16)
                .fire(this.game.bullets)
            yield* Array(12)
        }

        yield* Array(150 - (side > 0 ? 6 : 0))
    }

    // 触角の探り。外寄りの上へ弾を撒き、少しして自機の方へ向きを変えて一気に飛ばす
    private *probe(me: Part, side: number) {
        yield* remodel(me)
            .format("diamond")
            .color("#e0d8ff")
            .p(me.p.clone())
            .speed(3)
            .radian(-T / 4 + side * 0.9)
            .nway(4, 0.35)
            .g(function* (b) {
                yield* Behavior.stop(b, 20)
                yield* Behavior.aim(b, this.game.player.p, 10)
                yield* Behavior.accel(b, 15, 7)
            })
            .fire(this.game.bullets)

        yield* Array(70)
    }

    // 鈴の音。k 番目の鈴は 12k フレーム待ってから鈴玉を落とす。鈴玉は少し落ちてから、輪になって鳴り響く
    private *bell(me: Part, k: number) {
        yield* Array(k * 12)

        yield* remodel(me)
            .format("big-ball")
            .color("#fff0b0")
            .p(me.p.clone())
            .speed(2.5)
            .radian(T / 4)
            .g(function* (b) {
                yield* Behavior.stop(b, 40)

                yield* remodel(this)
                    .format("small-ball")
                    .r(5)
                    .color("#fff8d8")
                    .p(b.p.clone())
                    .speed(4.5)
                    .radian(this.random() * T)
                    .ex(10)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(230 - k * 12)
    }

    // 胴の月の輪。翅があるうちは、ときどき輪を放つだけ。
    // 翅を落とすと、一度広がって止まり、その場でくるりと回ってから外へ散る輪になる
    private *moonRing() {
        if (this.wings.some((p) => p.life > 0)) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#e0d8ff")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(18)
                .fire(this.game.bullets)

            yield* Array(170)
            return
        }

        const turn = this.random() < 0.5 ? -0.03 : 0.03

        yield* remodel(this)
            .format("diamond")
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(6)
            .radian(this.random() * T)
            .ex(28)
            .g(function* (b) {
                const center = b.p.clone()
                yield* Behavior.stop(b, 25)

                let angle = b.p.sub(center).radian()
                const radius = b.p.sub(center).magnitude()
                for (let f = 0; f < 45; f++) {
                    angle += turn
                    b.p = center.add(vec.arg(angle).scale(radius))
                    b.radian = angle
                    yield
                }

                yield* Behavior.accel(b, 20, 6)
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
