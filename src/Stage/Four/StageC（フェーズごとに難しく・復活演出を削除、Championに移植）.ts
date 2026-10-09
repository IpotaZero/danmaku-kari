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
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        let from = vec(-200, -200)

        for (let generation = 0; generation < 3; generation++) {
            const boss = new EnemyBoss(this.game, generation, from)
            this.game.enemies.push(boss, ...boss.parts)

            while (boss.life > 0) {
                from = boss.p.clone()
                yield
            }

            yield* this.waitAllEnemiesDead()
            if (generation === 2) break

            yield* Array(40)
            this.game.enemies.push(new EnemyEgg(this.game, from))
            yield* this.waitAllEnemiesDead()
        }

        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyEgg extends Enemy {
    constructor(game: Game, p: Vec) {
        super(game, 1, 26)
        this.p = p.clone()
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
        if (this.frame % 24 < 3) yield* Charge.ring(this, "#ff9050")
        yield* Array(3)
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.08, 2, 3)

    // 翼(左右)
    readonly wings: Part[]
    readonly parts: Part[]

    constructor(game: Game, generation: number, from: Vec) {
        super(game, 1400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = from.clone()

        this.wings = [-1, 1].map(
            (side) =>
                new Part(
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
                    150 + (side > 0 ? 40 : 0),
                ),
        )

        // 尾羽(五枚)。胴の下に横一列に並ぶ
        const tails = [0, 1, 2, 3, 4].map(
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

        this.parts = [...this.wings, ...tails]

        this.addScript(() => this.enter(generation))
        this.addScript(() => this.phases(generation))
    }

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
        this.addScript(() => this.ring(generation), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        this.isInvincible = false
        this.game.camera.shake(6, 20)
        this.addScript(() => this.spiral(generation), { loop: Infinity, id: "body" })
    }

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
