import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"

// ステージ「スズムシ」(月影道場・道場主)
// 道場主のまわりに子機が幾何学的に並ぶ。胴のすぐ左右に翅の一対、その外側に触角の一対、胴の下に六つの鈴の横一列。
// 翅: 擦り合わせて音を鳴らす。左右の翅から同時に半円の波が広がり、二つの波が重なって格子のような隙間ができる。
// 触角: 探るように弾を撒き、少しして自機の方へ向きを変えて飛ばす。
// 鈴: 順に鈴玉を落とす。鈴玉は少し落ちてから、輪になって鳴り響く。
// 鈴は胴の下に並んでいるので、胴を撃とうとすると鈴に当たる。鈴を落とすと胴の下が開ける。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ。
// 一段目: 翅を両方落とすと次の段へ。胴はときどき輪を放つ。
// 合奏: 胴は大きく息を吸い込んで、胴の下に横一列に三匹の子スズムシを呼ぶ。子スズムシのまわりを小鈴(孫機)が二つずつ回り、小鈴を落とすまで子スズムシに攻撃が効かない。
// 二段目: 子スズムシをすべて落とすと次の段へ。子スズムシも半円の波を鳴らすので、三つの波が重なって、隙間がもっと細かくなる。
//         胴は月の輪(一度広がって止まり、くるりと回ってから散る輪)を放つ。
// 三段目: 満月。胴に攻撃が効くようになり、胴は自分でも半円の波を鳴らしながら、月の輪を放つ。

export default class extends Stage {
    *G() {
        const boss = new EnemySuzumushi(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemySuzumushi extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.35, this.game.HEIGHT * 0.07, 2, 3)

    // 翅(左右一対)。胴のすぐ左右にある
    private readonly wings = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                700,
                34,
                () => vec(side * 60, 0),
                (me) => this.chirp(me, side, 17),
                150,
            ),
    )

    // 触角(左右一対)。翅のさらに外側にある
    private readonly antennae = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                300,
                14,
                () => vec(side * 135, 0),
                (me) => this.probe(me, side),
                130 + (side > 0 ? 35 : 0),
            ),
    )

    // 鈴(六つ)。胴の下に横一列に並ぶ
    private readonly bells = [0, 1, 2, 3, 4, 5].map(
        (k) =>
            new Part(
                this.game,
                this,
                180,
                14,
                () => vec((k - 2.5) * 44, 100),
                (me) => this.bell(me, k),
                170,
            ),
    )

    readonly parts = [...this.wings, ...this.antennae, ...this.bells]

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        // 一段目: 翅を両方落とすと次の段へ
        this.addScript(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        // 合奏。大きく息を吸い込んでから、小鈴(孫機)に守られた子スズムシを呼ぶ
        this.removeScript("body")
        yield* Charge.gather(this, 150, "#fff0b0")

        const crickets = [-1, 0, 1].map((k) => {
            const cricket = new Part(
                this.game,
                this,
                320,
                20,
                () => vec(k * 115, 210),
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
                        (me) => vec.arg(me.frame / 60 + (side > 0 ? 0 : Math.PI)).scale(34),
                        (me) => this.smallBell(me),
                        100 + (side > 0 ? 60 : 0),
                    ),
            )
            cricket.guardedBy(smallBells)
            this.game.enemies.push(cricket, ...smallBells)
            return cricket
        })

        // 二段目: 子スズムシをすべて落とすと次の段へ。胴は月の輪を放つ
        this.addScript(() => this.moonRing(), { loop: Infinity, margin: 90, id: "body" })
        while (crickets.some((p) => p.life > 0)) yield

        // 三段目: 満月。胴に攻撃が効くようになり、胴も半円の波を鳴らす
        this.isInvincible = false
        this.game.camera.shake(8, 30)
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
