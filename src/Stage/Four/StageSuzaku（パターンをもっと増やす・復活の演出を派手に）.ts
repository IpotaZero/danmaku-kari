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

// ステージ「朱雀」(四天王)
// 朱雀は不死鳥。左右の翼と、扇のように広がる五枚の尾羽を持ち、それぞれが別々の攻撃をする。
// 翼: 羽ばたくたびに、外側の斜め下へ炎の羽の扇を二度払う。
// 尾羽: 火の粉を高く舞い上げる。火の粉は放物線を描いて落ち、落ちたところで小さく弾ける。
// 胴: 両方の翼を落とすと、攻撃が効くようになる。ただし翼は七秒ほどで炎の中から蘇る(蘇った翼は少しもろい)。
//     翼のない間、胴は怒って炎の渦を撒く。翼を落としては胴を撃つ、をくり返す。尾羽は蘇らないので、先に落とすと楽になる。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["あったかい……というか、熱い!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が二、南の朱雀。灰より蘇る者。"], { name: "朱雀" })
        yield* this.game.textBox.say(["翼を落としても無駄だ。我は何度でも蘇る。"], { name: "朱雀" })
        this.hideFigure("hachinoko")

        const boss = new EnemySuzaku(this.game)
        this.game.enemies.push(boss, ...boss.wings, ...boss.tails)

        // 翼が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.wings.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……蘇る前に、討たれたか。"], { name: "朱雀" })
        yield* this.game.textBox.say(["もう生き返らないよね……?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["さてな。西へ行け。白虎の爪は鋭いぞ。"], { name: "朱雀" })
        this.hideFigure("hachinoko")
    }
}

class EnemySuzaku extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.08, 2, 3)

    // 翼(左右)。落ちても蘇るので、中身は入れ替わる
    readonly wings = [-1, 1].map((side) => this.wing(side, 600))

    // 尾羽(五枚)。胴の下に扇のように広がって揺れる
    readonly tails = [0, 1, 2, 3, 4].map(
        (k) =>
            new Part(
                this.game,
                this,
                220,
                15,
                (me) => vec.arg(T / 4 + (k - 2) * 0.32 + 0.08 * Math.sin(me.frame / 15 + k)).scale(78),
                (me) => this.embers(me, k),
                160,
            ),
    )

    constructor(game: Game) {
        super(game, 2400, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.rebirth(), { loop: Infinity, margin: 120 })
    }

    private wing(side: number, life: number) {
        return new Part(
            this.game,
            this,
            life,
            36,
            (me) => vec(side * 92, -10 - 22 * Math.sin(me.frame / 9)),
            (me) => this.feathers(me, side),
            50 + (side > 0 ? 40 : 0),
        )
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.blaze(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    // 不死鳥の再生。両方の翼が落ちてから七秒ほどで、少しもろい翼が蘇る
    private *rebirth() {
        while (this.wings.some((p) => p.life > 0)) yield

        yield* Array(420)

        this.game.camera.shake(6, 25)
        this.wings.splice(0, this.wings.length, ...[-1, 1].map((side) => this.wing(side, 400)))
        this.game.enemies.push(...this.wings)
    }

    // 翼の炎の羽。外側の斜め下へ、ゆっくり出て一気に速くなる扇を二度払う
    private *feathers(me: Part, side: number) {
        for (let k = 0; k < 2; k++) {
            yield* remodel(me)
                .format("diamond")
                .color("#ff9a60")
                .p(me.p.clone())
                .speed(2)
                .radian(T / 4 - side * (0.75 + k * 0.12))
                .nway(7, T / 32)
                .g((b) => Behavior.ease(b, "speed", 7, 35, Ease.In))
                .fire(this.game.bullets)
            yield* Array(12)
        }

        yield* Array(80)
    }

    // 尾羽の火の粉。高く舞い上がり、放物線を描いて落ち、落ちたところで小さく弾ける
    private *embers(me: Part, k: number) {
        yield* Array(k * 15)

        yield* remodel(me)
            .format("small-ball")
            .r(6)
            .color("#ffd070")
            .p(me.p.clone())
            .speed(5)
            .radian(-T / 4 + (k - 2) * 0.35)
            .nway(3, 0.15)
            .unbounded()
            .g(function* (b) {
                let v = vec.arg(b.radian).scale(b.speed)
                for (let f = 0; f < 80; f++) {
                    v = v.add(vec(0, 0.15))
                    b.radian = v.radian()
                    b.speed = v.magnitude()
                    yield
                }

                yield* remodel(this)
                    .format("small-ball")
                    .r(4)
                    .color("#ffb070")
                    .p(b.p.clone())
                    .speed(3.5)
                    .radian(this.random() * T)
                    .ex(6)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(210 - k * 15)
    }

    // 胴の炎。翼があるうちは、ときどき輪を放つ。翼がない間は、逆回りの二本の渦を撒く
    private *blaze() {
        if (this.wings.some((p) => p.life > 0)) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#ffc0a0")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(18)
                .fire(this.game.bullets)

            yield* Array(160)
            return
        }

        const base = this.random() * T

        for (let f = 0; f < 90; f += 5) {
            yield* remodel(this)
                .format("diamond")
                .color("#ff7050")
                .p(this.p.clone())
                .speed(5)
                .radian(base + f * 0.04)
                .ex(3)
                .fire(this.game.bullets)
            yield* remodel(this)
                .format("diamond")
                .color("#ffb050")
                .p(this.p.clone())
                .speed(5)
                .radian(base - f * 0.04)
                .ex(3)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(50)
    }
}
