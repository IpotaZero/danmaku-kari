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

    private readonly firstWings = [-1, 1].map((side) => new Wing(this.game, this, side, 0))
    private readonly tails = [0, 1, 2, 3, 4].map((k) => new TailFeather(this.game, this, k))

    readonly parts = [...this.firstWings, ...this.tails]

    constructor(game: Game) {
        super(game, 1400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        this.scripts.add(() => this.ring(0), { loop: Infinity, margin: 180, id: "body" })
        while (this.firstWings.some((p) => p.life > 0)) yield

        for (const generation of [1, 2]) {
            this.scripts.remove("body")
            yield* Charge.gather(this, 120, "#ff9050")

            const wings = [-1, 1].map((side) => new Wing(this.game, this, side, generation))
            this.game.enemies.push(...wings)
            this.scripts.add(() => this.ring(generation), { loop: Infinity, margin: 60, id: "body" })

            while (wings.some((p) => p.life > 0)) yield
        }

        this.scripts.remove("body")
        yield* Charge.gather(this, 120, "#ff7050")
        this.isInvincible = false
        this.scripts.add(() => this.spiral(), { loop: Infinity, id: "body" })
    }

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

class Wing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly generation: number,
    ) {
        super(game, parent, 500, Size.L, generation === 0 ? 150 + (side > 0 ? 40 : 0) : 60 + (side > 0 ? 40 : 0))
    }

    protected place() {
        return vec(this.side * 104, -10)
    }

    protected *attack() {
        if (this.generation === 0) yield* this.feathers()
        else if (this.generation === 1) yield* this.flameBand()
        else yield* this.firebirds()
    }

    private *feathers() {
        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .format("diamond")
                .color("#ff9a60")
                .p(this.p.clone())
                .speed(2)
                .radian(T / 4 - this.side * (0.75 + k * 0.12))
                .nway(11, T / 40)
                .g((b) => Behavior.ease(b, "speed", 7, 35, Ease.In))
                .fire(this.game.bullets)
            yield* Array(12)
        }

        yield* Array(60)
    }

    private *flameBand() {
        for (let f = 0; f < 60; f += 3) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ff8a50")
                .p(this.p.clone())
                .speed(5.5)
                .radian(T / 4 - this.side * (1.1 - f * 0.025))
                .nway(3, 0.25)
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(60)
    }

    private *firebirds() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffb050")
            .p(this.p.clone())
            .speed(5)
            .radian(-this.side * 0.3 + (this.side > 0 ? 0 : Math.PI))
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
}

class TailFeather extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 200, Size.S, 160)
    }

    protected place() {
        return vec((this.k - 2) * 50, 90)
    }

    protected *attack() {
        yield* Array(this.k * 15)

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#ffd070")
            .p(this.p.clone())
            .speed(5)
            .radian(-T / 4 + (this.k - 2) * 0.35)
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

        yield* Array(170 - this.k * 15)
    }
}
