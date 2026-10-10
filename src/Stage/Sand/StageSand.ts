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
        const boss = new EnemyUsuba(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyUsuba extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 2, 3)

    private readonly jaws = [-1, 1].map((side) => new Jaw(this.game, this, side))
    private readonly abdomen = new Abdomen(this.game, this)
    private readonly sandbags = [-1, 0, 1].map((k) => new Sandbag(this.game, this.abdomen, k))
    private readonly legs = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
    ].map(([side, row]) => new Leg(this.game, this, side, row))

    private readonly guards = [...this.jaws, this.abdomen]
    readonly parts = [...this.jaws, this.abdomen, ...this.sandbags, ...this.legs]

    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.abdomen.guardedBy(this.sandbags)

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 240).add(this.home())
        yield
    }

    private *sync() {
        yield* Array((330 - ((this.frame - 150) % 330)) % 330)
    }

    private untilNextCycle() {
        const rest = (330 - ((this.frame - 150) % 330)) % 330
        return rest < 60 ? rest + 330 : rest
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 150, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#ffd890")

        const wings = [
            [-1, 0],
            [1, 0],
            [-1, 1],
            [1, 1],
        ].map(([side, row]) => new Wing(this.game, this, side, row, this.untilNextCycle()))
        this.game.enemies.push(...wings)

        yield* this.sync()
        this.scripts.add(() => this.curtain(), { loop: Infinity, id: "body" })
        while (wings.some((p) => p.life > 0)) yield

        this.isInvincible = false
        this.game.camera.shake(8, 30)
        yield* this.sync()
        this.scripts.add(() => this.whirl(), { loop: Infinity, id: "whirl" })
    }

    private *ring() {
        yield* Array(100)

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#fff0c0")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(20)
            .fire(this.game.bullets)

        yield* Array(230)
    }

    private *curtain() {
        const base = (this.random() - 0.5) * 0.3

        for (let k = 0; k < 2; k++) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffc870")
                .p(this.p.clone())
                .speed(6)
                .radian(T / 4 + base + k * 0.125)
                .nway(11, 0.25)
                .g(function* (b) {
                    yield* Behavior.stop(b, 45)
                    yield* Array(15)
                    b.radian = T / 4
                    yield* Behavior.accel(b, 40, 5)
                })
                .fire(this.game.bullets)
            yield* Array(30)
        }

        yield* Array(270)
    }

    private *whirl() {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 90; f += 5) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffc870")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * f * 0.035)
                .ex(6)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(240)
    }
}

class Jaw extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 500, Size.L, 150)
    }

    protected place() {
        return vec(this.side * 64, 88)
    }

    protected *attack() {
        yield* Array(this.side > 0 ? 20 : 0)

        for (let f = 0; f < 60; f += 3) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffd890")
                .p(this.p.clone())
                .speed(5)
                .radian(T / 4 + this.side * 0.9)
                .g((b) => Behavior.rotating(b, -this.side * 0.02, 80))
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(270 - (this.side > 0 ? 20 : 0))
    }
}

class Abdomen extends Part {
    constructor(game: Game, parent: Enemy) {
        super(game, parent, 600, Size.L, 150)
    }

    protected place() {
        return vec(0, -105)
    }

    protected *attack() {
        yield* Array(40)

        yield* remodel(this)
            .format("diamond")
            .color("#ffe8b8")
            .p(this.p.clone())
            .speed(5)
            .duplicate(16)
            .scatter({ radian: [-T / 4 - 0.7, -T / 4 + 0.7], speed: [3.5, 6.5] })
            .unbounded()
            .g(function* (b) {
                let v = vec.arg(b.radian).scale(b.speed)

                while (b.p.y < b.game.HEIGHT + 20) {
                    v = v.add(vec(0, 0.13))
                    b.radian = v.radian()
                    b.speed = v.magnitude()
                    yield
                }

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(290)
    }
}

class Sandbag extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 150, Size.S, 150)
    }

    protected place() {
        return vec.arg(this.frame / 120 + (T * (this.k + 1)) / 3).scale(64)
    }

    protected *attack() {
        yield* Array(60 + (this.k + 1) * 12)

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#fff0c0")
            .p(this.p.clone())
            .speed(0.5)
            .radian(T / 4)
            .duplicate(3)
            .delayByIndex(6)
            .nway(3, 0.25)
            .g((b) => Behavior.ease(b, "speed", 6, 60, Ease.In))
            .fire(this.game.bullets)

        yield* Array(330 - 60 - (this.k + 1) * 12 - 12)
    }
}

class Leg extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly row: number,
    ) {
        super(game, parent, 260, Size.M, 150)
    }

    protected place() {
        return vec(this.side * (105 + 65 * this.row), 20)
    }

    protected *attack() {
        yield* Array(30 + this.row * 30)

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#f0c878")
            .p(this.p.clone())
            .duplicate(10)
            .scatter({ radian: [T / 4 + this.side * 0.15 - 0.35, T / 4 + this.side * 0.15 + 0.35], speed: [3.5, 7] })
            .fire(this.game.bullets)

        yield* Array(300 - this.row * 30)
    }
}

class Wing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly row: number,
        delay: number,
    ) {
        super(game, parent, 250, Size.M, delay)
    }

    protected place() {
        return vec(this.side * 78, this.row === 0 ? -78 : 78)
    }

    protected *attack() {
        yield* Array(this.row * 30)

        yield* remodel(this)
            .format("big-ball")
            .color("#ffe0a0")
            .p(this.p.clone())
            .speed(3)
            .radian(T / 4 + this.side * 0.5)
            .g(function* (b) {
                yield* Array(35)

                yield* remodel(this)
                    .format("small-ball")
                    .r(5)
                    .color("#ffe8c0")
                    .p(b.p.clone())
                    .speed(5)
                    .radian(b.radian)
                    .nway(5, 0.3)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(330 - this.row * 30)
    }
}
