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
import { Charge } from "../Charge"
import { Size } from "../Size"

// 胴の左右に翼の一対、胴の下に五枚の尾羽の横一列が並ぶ。
// 段は翼の一対を落とすと進む。翼を落とすたびに、胴は力を溜めて、もっと激しい翼の一対を出す。三対目を落とすと胴に攻撃が効くようになる。
//   一対目の翼: 外側の斜め下へ、炎の羽の扇を三度払う。
//   二対目の翼: 外から内へ、三筋の炎の帯を薙ぎ払う。左右の帯は胴の下で交差する。
//   三対目の翼: 火の鳥を七羽放つ。火の鳥は外へ飛び出して止まり、自機のいた所へ急降下する。
// 尾羽: 火の粉を高く舞い上げる。火の粉は放物線を描いて落ち、落ちたところで小さく弾ける。尾羽は出し直されない。
// 胴: 翼があるうちは輪を放つ。段が進むほど輪は濃く、重なりも増える。三対目の翼を落とすと、逆回りの炎の渦を撒く。

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.08, 2, 3)

    // 一対目の翼
    private readonly firstWings = [-1, 1].map((side) => this.wing(side, 0))

    // 尾羽(五枚)。胴の下に横一列に並ぶ
    private readonly tails = [0, 1, 2, 3, 4].map(
        (k) =>
            new Part(
                this.game,
                this,
                200,
                Size.S,
                () => vec((k - 2) * 50, 90),
                (me) => this.embers(me, k),
                160,
            ),
    )

    readonly parts = [...this.firstWings, ...this.tails]

    constructor(game: Game) {
        super(game, 1400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.phases())
    }

    // generation 対目の翼。対によって攻撃が変わる
    private wing(side: number, generation: number) {
        return new Part(
            this.game,
            this,
            500,
            Size.L,
            () => vec(side * 104, -10),
            (me) =>
                generation === 0
                    ? this.feathers(me, side)
                    : generation === 1
                      ? this.flameBand(me, side)
                      : this.firebirds(me, side),
            generation === 0 ? 150 + (side > 0 ? 40 : 0) : 60 + (side > 0 ? 40 : 0),
        )
    }

    private *enter() {
        this.p = vec(-200, -200)
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

    private *phases() {
        // 一対目の翼を落とすまで
        this.addScript(() => this.ring(0), { loop: Infinity, margin: 180, id: "body" })
        while (this.firstWings.some((p) => p.life > 0)) yield

        // 二対目・三対目。落とすたびに力を溜めて、もっと激しい翼を出す
        for (const generation of [1, 2]) {
            this.removeScript("body")
            yield* Charge.gather(this, 120, "#ff9050")

            const wings = [-1, 1].map((side) => this.wing(side, generation))
            this.game.enemies.push(...wings)
            this.addScript(() => this.ring(generation), { loop: Infinity, margin: 60, id: "body" })

            while (wings.some((p) => p.life > 0)) yield
        }

        // 三対目を落とすと、胴に攻撃が効くようになり、炎の渦を撒く
        this.removeScript("body")
        yield* Charge.gather(this, 120, "#ff7050")
        this.isInvincible = false
        this.addScript(() => this.spiral(), { loop: Infinity, id: "body" })
    }

    // 一対目の翼。外側の斜め下へ、ゆっくり出て一気に速くなる炎の羽の扇を三度払う
    private *feathers(me: Part, side: number) {
        for (let k = 0; k < 3; k++) {
            yield* remodel(me)
                .format("diamond")
                .color("#ff9a60")
                .p(me.p.clone())
                .speed(2)
                .radian(T / 4 - side * (0.75 + k * 0.12))
                .nway(11, T / 40)
                .g((b) => Behavior.ease(b, "speed", 7, 35, Ease.In))
                .fire(this.game.bullets)
            yield* Array(12)
        }

        yield* Array(60)
    }

    // 二対目の翼。外から内へ、炎の帯を薙ぎ払う。帯は三筋
    private *flameBand(me: Part, side: number) {
        for (let f = 0; f < 60; f += 3) {
            yield* remodel(me)
                .format("small-ball")
                .r(6)
                .color("#ff8a50")
                .p(me.p.clone())
                .speed(5.5)
                .radian(T / 4 - side * (1.1 - f * 0.025))
                .nway(3, 0.25)
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(60)
    }

    // 三対目の翼。火の鳥を七羽放つ。外へ飛び出して止まり、自機のいた所へ急降下する
    private *firebirds(me: Part, side: number) {
        yield* remodel(me)
            .format("arrow")
            .color("#ffb050")
            .p(me.p.clone())
            .speed(5)
            .radian(-side * 0.3 + (side > 0 ? 0 : Math.PI))
            .nway(7, 0.28)
            .g(function* (b) {
                yield* Behavior.stop(b, 25)
                yield* Array(10)
                yield* Behavior.aim(b, this.game.player.p, 8)
                yield* Behavior.accel(b, 15, 9)
            })
            .fire(this.game.bullets)

        yield* Array(70)
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
            .nway(4, 0.13)
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
                    .ex(8)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(170 - k * 15)
    }

    // 翼があるうちの胴の輪。段が進むほど濃く、重なりも増え(一重・二重・三重)、二対目からは一度止まってから散る
    private *ring(generation: number) {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffc0a0")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(24 + generation * 8)
            .duplicate(generation + 1, (b, k) => {
                b.radian += (k * T) / 60
                b.speed += k
                return b
            })
            .g((b) => (generation > 0 ? Behavior.reaccel(b, 20, 15, 30, 5) : Behavior.accel(b, 1, 3.5)))
            .fire(this.game.bullets)

        yield* Array(140 - generation * 20)
    }

    // 三対目を落とした胴の炎の渦。逆回りの二つの渦。腕は七本ずつ
    private *spiral() {
        const base = this.random() * T

        for (let f = 0; f < 90; f += 5) {
            yield* remodel(this)
                .format("diamond")
                .color("#ff7050")
                .p(this.p.clone())
                .speed(5)
                .radian(base + f * 0.04)
                .ex(7)
                .fire(this.game.bullets)
            yield* remodel(this)
                .format("diamond")
                .color("#ffb050")
                .p(this.p.clone())
                .speed(5)
                .radian(base - f * 0.04)
                .ex(7)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(40)
    }
}
