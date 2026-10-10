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
import { Size } from "../Size"

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

    private readonly wings = [-1, 1].map((side) => new Wing(this.game, this, side))
    private readonly antennae = [-1, 1].map((side) => new Antenna(this.game, this, side))
    private readonly bells = [0, 1, 2, 3, 4, 5].map((k) => new Bell(this.game, this, k))

    readonly parts = [...this.wings, ...this.antennae, ...this.bells]

    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#fff0b0")

        const crickets = [-1, 0, 1].map((k) => {
            const cricket = new Cricket(this.game, this, k)
            const smallBells = [-1, 1].map((side) => new SmallBell(this.game, cricket, side))
            cricket.guardedBy(smallBells)
            this.game.enemies.push(cricket, ...smallBells)
            return cricket
        })

        this.scripts.add(() => this.moonRing(), { loop: Infinity, margin: 90, id: "body" })
        while (crickets.some((p) => p.life > 0)) yield

        this.isInvincible = false
        this.game.camera.shake(8, 30)
        this.scripts.add(() => Suzumushi.chirp(this, 0, 21), { loop: Infinity, margin: 30, id: "song" })
    }

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

namespace Suzumushi {
    export function* chirp(me: Enemy, side: number, count: number) {
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
                .fire(me.game.bullets)
            yield* Array(12)
        }

        yield* Array(150 - (side > 0 ? 6 : 0))
    }
}

class Wing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 700, Size.L, 150)
    }

    protected place() {
        return vec(this.side * 60, 0)
    }

    protected *attack() {
        yield* Suzumushi.chirp(this, this.side, 17)
    }
}

class Antenna extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 300, Size.M, 130 + (side > 0 ? 35 : 0))
    }

    protected place() {
        return vec(this.side * 135, 0)
    }

    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(3)
            .radian(-T / 4 + this.side * 0.9)
            .nway(4, 0.35)
            .g(function* (b) {
                yield* Behavior.stop(b, 20)
                yield* Behavior.aim(b, this.game.player.p, 10)
                yield* Behavior.accel(b, 15, 7)
            })
            .fire(this.game.bullets)

        yield* Array(70)
    }
}

class Bell extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 180, Size.S, 170)
    }

    protected place() {
        return vec((this.k - 2.5) * 50, 100)
    }

    protected *attack() {
        yield* Array(this.k * 12)

        yield* remodel(this)
            .format("big-ball")
            .color("#fff0b0")
            .p(this.p.clone())
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

        yield* Array(230 - this.k * 12)
    }
}

class Cricket extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 320, Size.M, 60 + (k + 1) * 8)
    }

    protected place() {
        return vec(this.k * 115, 210)
    }

    protected *attack() {
        yield* Suzumushi.chirp(this, this.k, 13)
    }
}

class SmallBell extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 90, Size.S, 100 + (side > 0 ? 60 : 0))
    }

    protected place() {
        return vec.arg(this.frame / 60 + (this.side > 0 ? 0 : Math.PI)).scale(56)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(8)
            .color("#fff0b0")
            .p(this.p.clone())
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
}
