import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"

// ステージ「朱雀」(四天王)
// 朱雀は不死鳥。二度倒しても灰の中から蘇り、三度目でようやく倒れる。蘇ることがこの戦いのテーマ。
// 朱雀は左右の翼と、扇のように広がる五枚の尾羽を持つ。両方の翼を落とすまで、胴に攻撃が効かない。
// 尾羽: 火の粉を高く舞い上げる。火の粉は放物線を描いて落ち、落ちたところで小さく弾ける。
// 胴: 翼があるうちはときどき輪を放ち、翼を落とされると、逆回りの炎の渦を撒く。
// 再生: 朱雀が倒れると、灰の中から炎の卵が現れる。卵は温まりきる(充電が満ちる)まで何もせず、撃っても割れない。
//       撃つほど早く温まる。孵る瞬間、画面が燃え上がり、生まれた朱雀は炎の輪を放ちながら舞い上がる。
// 蘇るたびに、翼の攻撃は変わり、胴の攻撃は激しくなる。
//   一代目の翼: 外側の斜め下へ、炎の羽の扇を二度払う。
//   二代目の翼: 外から内へ、炎の帯を薙ぎ払う。左右の帯は胴の下で交差する。
//   三代目の翼: 火の鳥を三羽放つ。火の鳥は外へ飛び出して止まり、自機のいた所へ急降下する。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["あったかい……というか、熱い!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が二、南の朱雀。灰より蘇る者。"], { name: "朱雀" })
        yield* this.game.textBox.say(["我を討つなら、三度討て。"], { name: "朱雀" })
        this.hideFigure("hachinoko")

        // 朱雀が現れる場所。一代目は画面の外から、二代目からは卵の孵った所から
        let from = vec(-200, -200)

        for (let generation = 0; generation < 3; generation++) {
            const boss = new EnemySuzaku(this.game, generation, from)
            this.game.enemies.push(boss, ...boss.parts)

            while (boss.life > 0) {
                from = boss.p.clone()
                yield
            }

            yield* this.waitAllEnemiesDead()
            if (generation === 2) break

            // 灰の中から炎の卵が現れ、温まりきると孵る
            yield* Array(40)
            this.game.enemies.push(new EnemyEgg(this.game, from))
            yield* this.waitAllEnemiesDead()

            this.flash("#ff9050c0", 30)
            this.game.camera.shake(12, 45)
        }

        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["三度も討たれるとは。灰に還るとしよう。"], { name: "朱雀" })
        yield* this.game.textBox.say(["もう生き返らないよね……?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["さてな。西へ行け。白虎の爪は鋭いぞ。"], { name: "朱雀" })
        this.hideFigure("hachinoko")
    }
}

// 灰の中から現れる炎の卵。温まりきる(充電が満ちる)まで何もせず、撃っても割れない。撃つほど早く温まる。
// 温まっている間、まわりから炎の粒が卵へ吸い込まれていく
class EnemyEgg extends Enemy {
    constructor(game: Game, p: Vec) {
        super(game, 1, 26)
        this.p = p.clone()
        // 温まり始めるまでに撃たれて割れないよう、最初は攻撃を効かなくしておく
        this.isInvincible = true

        this.addScript(() => this.warm())
        this.addScript(() => this.glow(), { loop: Infinity })
    }

    private *warm() {
        this.isInvincible = false
        yield* this.battery.charge(300)
        this.life = 0
        yield
    }

    private *glow() {
        yield* Charge.particle(this, "#ff9050")
        yield* Array(3)
    }
}

class EnemySuzaku extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.08, 2, 3)

    // 翼(左右)
    readonly wings: Part[]
    readonly parts: Part[]

    constructor(game: Game, generation: number, from: Vec) {
        super(game, 1400, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = from.clone()

        this.wings = [-1, 1].map(
            (side) =>
                new Part(
                    this.game,
                    this,
                    500,
                    36,
                    () => vec(side * 92, -10),
                    (me) =>
                        generation === 0
                            ? this.feathers(me, side)
                            : generation === 1
                              ? this.flameBand(me, side)
                              : this.firebirds(me, side),
                    150 + (side > 0 ? 40 : 0),
                ),
        )

        // 尾羽(五枚)。胴の下に扇のように広がる
        const tails = [0, 1, 2, 3, 4].map(
            (k) =>
                new Part(
                    this.game,
                    this,
                    200,
                    15,
                    () => vec.arg(T / 4 + (k - 2) * 0.32).scale(78),
                    (me) => this.embers(me, k),
                    160,
                ),
        )

        this.parts = [...this.wings, ...tails]

        this.addScript(() => this.enter(generation))
        this.addScript(() => this.phases(generation))
    }

    // 一代目は画面の外から飛んでくる。二代目からは、卵の孵った所で炎の輪を放ちながら舞い上がる
    private *enter(generation: number) {
        if (generation > 0) {
            yield* Charge.burst(this, "#ff8040")
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffb070")
                .p(this.p.clone())
                .speed(1.5)
                .radian(this.random() * T)
                .ex(24 + generation * 6)
                .g((b) => Behavior.ease(b, "speed", 5.5, 40, Ease.In))
                .fire(this.game.bullets)
        }

        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases(generation: number) {
        // 翼を両方落とすまで、胴に攻撃が効かない。胴はときどき輪を放つ
        this.addScript(() => this.ring(generation), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        // 翼を落とされると、胴に攻撃が効くようになり、炎の渦を撒く
        this.isInvincible = false
        this.game.camera.shake(6, 20)
        this.addScript(() => this.spiral(generation), { loop: Infinity, id: "body" })
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

    // 三代目の翼。火の鳥を三羽放つ。外へ飛び出して止まり、自機のいた所へ急降下する
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

    // 翼があるうちの胴の輪。代を重ねるほど濃くなり、二代目からは一度止まってから散る
    private *ring(generation: number) {
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
    }

    // 翼を落とされた胴の炎の渦。逆回りの二つの渦。代を重ねるほど腕が多くなる
    private *spiral(generation: number) {
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
