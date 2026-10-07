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
// 朱雀は不死鳥。左右の翼と、扇のように広がる五枚の尾羽を持つ。
// 尾羽: 火の粉を高く舞い上げる。火の粉は放物線を描いて落ち、落ちたところで小さく弾ける。尾羽は蘇らない。
// 胴: 両方の翼を落とすと、攻撃が効くようになる。翼のない間、胴は怒って炎の渦を撒く。
// 再生: 翼を両方落とすと、翼のあった所に炎の卵が二つ現れる。卵は温まる(充電する)と孵って、新しい翼になる。
//       卵は撃っても割れず、撃つほど早く孵ってしまう。卵に当てないように胴を撃つ。
//       孵る瞬間、画面が燃え上がり、胴から炎の輪がほとばしる。
// 蘇るたびに、翼の攻撃と胴の攻撃は激しくなる。
//   一代目の翼: 外側の斜め下へ、炎の羽の扇を二度払う。
//   二代目の翼: 外から内へ、炎の帯を薙ぎ払う。左右の帯は胴の下で交差する。
//   三代目からの翼: 火の鳥を三羽放つ。火の鳥は外へ飛び出して止まり、自機のいた所へ急降下する。
//   胴は、翼があるうちは輪を、翼のない間は渦を撒く。代を重ねるほど、輪は濃く、渦の腕は多くなる。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["あったかい……というか、熱い!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が二、南の朱雀。灰より蘇る者。"], { name: "朱雀" })
        yield* this.game.textBox.say(["翼を落としても無駄だ。我は何度でも蘇る。"], { name: "朱雀" })
        this.hideFigure("hachinoko")

        const boss = new EnemySuzaku(this.game)
        this.game.enemies.push(boss, ...boss.wings, ...boss.tails)

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

    // 翼(左右)。蘇るたびに中身が入れ替わる
    readonly wings = [-1, 1].map((side) => this.wing(side, 600, 0))

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
        super(game, 2600, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.rebirth(), { margin: 120 })
    }

    // generation 代目の翼。代によって攻撃が変わる
    private wing(side: number, life: number, generation: number) {
        return new Part(
            this.game,
            this,
            life,
            36,
            (me) => vec(side * 92, -10 - 22 * Math.sin(me.frame / 9)),
            (me) =>
                generation === 0
                    ? this.feathers(me, side)
                    : generation === 1
                      ? this.flameBand(me, side)
                      : this.firebirds(me, side),
            50 + (side > 0 ? 40 : 0),
        )
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.blaze(0), { loop: Infinity, margin: 60, id: "body" })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    // 不死鳥の再生。両方の翼が落ちると炎の卵が現れ、卵が孵ると次の代の翼になる
    private *rebirth() {
        for (let generation = 1; ; generation++) {
            while (this.wings.some((p) => p.life > 0)) yield

            // 翼がない間だけ、胴に攻撃が効く
            this.isInvincible = false

            const eggs = [-1, 1].map(
                (side) =>
                    new Part(
                        this.game,
                        this,
                        1,
                        20,
                        (me) => vec(side * 92, -10 + 4 * Math.sin(me.frame / 6)),
                        (me) => this.incubate(me),
                        0,
                    ),
            )
            // 温まり始めるまでに撃たれて割れないよう、最初は攻撃を効かなくしておく
            eggs.forEach((p) => (p.isInvincible = true))
            this.game.enemies.push(...eggs)

            while (eggs.some((p) => p.life > 0)) yield

            // 孵る。画面が燃え上がり、胴から炎の輪がほとばしる
            this.isInvincible = true
            this.game.stage.flash("#ff9050c0", 30)
            this.game.camera.shake(12, 45)

            yield* remodel(this)
                .format("big-ball")
                .type("effect")
                .isScorable(false)
                .color("#ff8040")
                .alpha(0.6)
                .p(this.p.clone())
                .speed(9)
                .radian(this.random() * T)
                .ex(40)
                .g((b) => Behavior.fadeout(b, 40))
                .fire(this.game.bullets)

            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffb070")
                .p(this.p.clone())
                .speed(2)
                .radian(this.random() * T)
                .ex(24 + generation * 4)
                .g((b) => Behavior.ease(b, "speed", 5.5, 40, Ease.In))
                .fire(this.game.bullets)

            this.wings.splice(0, this.wings.length, ...[-1, 1].map((side) => this.wing(side, 400, generation)))
            this.game.enemies.push(...this.wings)

            this.addScript(() => this.blaze(generation), { loop: Infinity, margin: 60, id: "body" })
        }
    }

    // 炎の卵。温まりきると孵る(割れて消え、そこに翼が生える)
    private *incubate(me: Part) {
        me.isInvincible = false
        yield* me.battery.charge(420)
        me.life = 0
        yield
    }

    // 一代目の翼。外側の斜め下へ、ゆっくり出て一気に速くなる炎の羽の扇を二度払う
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

    // 二代目の翼。外から内へ、炎の帯を薙ぎ払う
    private *flameBand(me: Part, side: number) {
        for (let f = 0; f < 60; f += 3) {
            yield* remodel(me)
                .format("small-ball")
                .r(6)
                .color("#ff8a50")
                .p(me.p.clone())
                .speed(5.5)
                .radian(T / 4 - side * (1.1 - f * 0.025))
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(90)
    }

    // 三代目からの翼。火の鳥を三羽放つ。外へ飛び出して止まり、自機のいた所へ急降下する
    private *firebirds(me: Part, side: number) {
        yield* remodel(me)
            .format("arrow")
            .color("#ffb050")
            .p(me.p.clone())
            .speed(5)
            .radian(-side * 0.3 + (side > 0 ? 0 : Math.PI))
            .nway(3, 0.5)
            .g(function* (b) {
                yield* Behavior.stop(b, 25)
                yield* Array(10)
                yield* Behavior.aim(b, this.game.player.p, 8)
                yield* Behavior.accel(b, 15, 8)
            })
            .fire(this.game.bullets)

        yield* Array(110)
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

    // 胴の炎。翼があるうちは輪を、翼がない間は逆回りの渦を撒く。代を重ねるほど、輪は濃く、渦の腕は多くなる
    private *blaze(generation: number) {
        if (this.wings.some((p) => p.life > 0)) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#ffc0a0")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(18 + generation * 6)
                .g((b) => (generation > 0 ? Behavior.reaccel(b, 20, 15, 30, 5) : Behavior.accel(b, 1, 3.5)))
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
                .ex(3 + generation)
                .fire(this.game.bullets)
            yield* remodel(this)
                .format("diamond")
                .color("#ffb050")
                .p(this.p.clone())
                .speed(5)
                .radian(base - f * 0.04)
                .ex(3 + generation)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(50)
    }
}
