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
// 鈴: そろって振り子のように揺れながら、順に鈴玉を落とす。鈴玉は少し落ちてから、輪になって鳴り響く。
// 鈴は胴の下にぶら下がっているので、胴を撃とうとすると鈴に当たる。鈴を落とすと胴の下が開ける。
// 一段目: 翅を両方落とすまで、胴に攻撃が効かない。胴はときどき輪を放つ。
// 二段目: 月の輪。一度広がって止まり、くるりと回ってから散る輪を放つ。
// 三段目: 合奏。胴は大きく息を吸う(充電)。吸っている間は攻撃が効かず、撃つほど早く吸い終わる。
//         吸い終わると三匹の子スズムシが現れ、それぞれ小鈴(孫機)を二つ吊るしている。
//         子スズムシも半円の波を鳴らすので、三つの波が重なって、隙間がもっと細かくなる。
// 四段目: 満月。胴は自分でも半円の波を鳴らしながら、月の輪を放つ。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["月が明るい……どこからか、鈴の音が。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["リーン……。月影道場へ、ようこそ。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["音の波の隙間を、くぐり抜けてごらんなさい。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")

        const boss = new EnemySuzumushi(this.game)
        this.game.enemies.push(boss, ...boss.parts)

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

    // 翅(左右)。ゆっくり開いたり閉じたりして、音を鳴らす
    private readonly wings = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                700,
                34,
                (me) => vec(side * (52 + 6 * Math.sin(me.frame / 20)), -14),
                (me) => this.chirp(me, side, 17),
                150,
            ),
    )

    // 触角(左右)。胴の斜め上へ長く伸びて、ゆっくり左右に揺れる
    private readonly antennae = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                300,
                14,
                (me) => vec(side * 95 + 10 * Math.sin(me.frame / 40), -90),
                (me) => this.probe(me, side),
                130 + (side > 0 ? 35 : 0),
            ),
    )

    // 鈴(六つ)。胴の下に吊るされて、六つそろって振り子のように揺れる。外側の鈴ほど糸が長い
    private readonly bells = [0, 1, 2, 3, 4, 5].map(
        (k) =>
            new Part(
                this.game,
                this,
                180,
                14,
                (me) =>
                    vec((k - 2.5) * 40, 30).add(
                        vec.arg(T / 4 + 0.25 * Math.sin(me.frame / 35)).scale(60 + 12 * Math.abs(k - 2.5)),
                    ),
                (me) => this.bell(me, k),
                170,
            ),
    )

    readonly parts = [...this.wings, ...this.antennae, ...this.bells]

    constructor(game: Game) {
        super(game, 3000, 46, { renderer: new EnemyRendererBoss() })
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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        // 一段目: 翅が残っている間は、胴に攻撃が効かない
        this.addScript(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        // 二段目: 月の輪
        this.isInvincible = false
        this.game.camera.shake(6, 20)
        this.addScript(() => this.moonRing(), { loop: Infinity, id: "body" })

        while (this.life > this.maxLife * 0.6) yield

        // 三段目: 合奏。息を吸ってから、小鈴(孫機)を吊るした子スズムシを呼ぶ
        this.removeScript("body")
        yield* this.battery.charge(180)
        this.game.camera.shake(8, 30)

        for (const k of [-1, 0, 1]) {
            const cricket = new Part(
                this.game,
                this,
                320,
                20,
                (me) => vec(k * 115 + 12 * Math.sin(me.frame / 30), 210 - Math.abs(k) * 30),
                (me) => this.chirp(me, k, 13),
                60 + (k + 1) * 8,
            )
            const smallBells = [-1, 1].map(
                (side) =>
                    new Part(
                        this.game,
                        cricket,
                        90,
                        10,
                        (me) => vec(side * 18, 0).add(vec.arg(T / 4 + 0.25 * Math.sin(me.frame / 35)).scale(34)),
                        (me) => this.smallBell(me),
                        100 + (side > 0 ? 60 : 0),
                    ),
            )
            this.game.enemies.push(cricket, ...smallBells)
        }

        this.addScript(() => this.moonRing(), { loop: Infinity, margin: 90, id: "body" })

        while (this.life > this.maxLife * 0.25) yield

        // 四段目: 満月。胴も半円の波を鳴らす
        this.game.camera.shake(6, 20)
        this.addScript(() => this.chirp(this, 0, 21), { loop: Infinity, margin: 30, id: "song" })
    }

    // 半円の音の波。下向きの半円の波を三つ続けて広げる。右寄りのものほど少し遅れるので、波がずれて重なる
    private *chirp(me: Enemy, side: number, count: number) {
        yield* Array(side > 0 ? 6 : 0)

        for (let k = 0; k < 3; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#fff0b0")
                .p(me.p.clone())
                .speed(4)
                .radian(T / 4)
                .nway(count, T / 2 / (count - 1))
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

    // 小鈴の音。小さな鈴玉が少し落ちてから、小さな輪になる
    private *smallBell(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(8)
            .color("#fff0b0")
            .p(me.p.clone())
            .speed(2.5)
            .radian(T / 4)
            .g(function* (b) {
                yield* Behavior.stop(b, 30)

                yield* remodel(this)
                    .format("small-ball")
                    .r(4)
                    .color("#fff8d8")
                    .p(b.p.clone())
                    .speed(4)
                    .radian(this.random() * T)
                    .ex(6)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(200)
    }

    // 一段目の胴。ときどき輪を放つ
    private *ring() {
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
    }

    // 月の輪。一度広がって止まり、その場でくるりと回ってから外へ散る
    private *moonRing() {
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
