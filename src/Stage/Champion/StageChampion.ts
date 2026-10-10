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
        const first = new EnemyHornet(this.game, 0, vec(-200, -200))
        this.game.enemies.push(first, ...first.parts)

        let from = first.p.clone()
        while (first.life > 0) {
            from = first.p.clone()
            yield
        }

        yield* this.waitAllEnemiesDead()

        this.scorenizeAllBullets()
        this.flash("#eef6ffc0", 40)
        this.scripts.add(() => this.quietSnow(), { loop: Infinity })

        yield* Array(40)
        this.game.enemies.push(new EnemyEgg(this.game, from))
        yield* this.waitAllEnemiesDead()

        const second = new EnemyHornet(this.game, 1, from)
        this.game.enemies.push(second, ...second.parts)
        second.snow()

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }

    private *quietSnow() {
        yield* remodel(this.game.player)
            .type("effect")
            .appearance("ball")
            .r(2)
            .color("#eef6ff")
            .alpha(0.3)
            .speed(1)
            .radian(T / 4)
            .p(vec(Math.random() * this.game.WIDTH, 0))
            .fire(this.game.bullets)

        yield* Array(8)
    }
}

class EnemyEgg extends Enemy {
    constructor(game: Game, p: Vec) {
        super(game, 1, Size.L, { charge: 100 })
        this.p = p.clone()

        this.scripts.add(() => this.hatch())
    }

    private *hatch() {
        this.life = 0
        yield
    }
}

class EnemyHornet extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.07, 2, 3)

    private readonly wings: Part[]
    readonly parts: Part[]

    constructor(game: Game, generation: number, from: Vec) {
        super(game, generation === 0 ? 2400 : 2800, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = from.clone()

        const mandibles = [-1, 1].map((side) => new Mandible(this.game, this, side, generation))

        this.wings =
            generation === 0
                ? [
                      [-1, 0],
                      [1, 0],
                      [-1, 1],
                      [1, 1],
                  ].map(([side, row]) => new SquareWing(this.game, this, side, row, generation))
                : [0, 1, 2, 3, 4, 5].map((i) => new HexWing(this.game, this, i, generation))

        const legs = [-3, -2, -1, 1, 2, 3].map((x, order) => new Leg(this.game, this, x, order, generation))
        const stinger = new Stinger(this.game, this, generation)

        const workers = Array.from({ length: generation === 0 ? 6 : 8 }, (_, i) => i).map(
            (i, _, all) => new Worker(this.game, this, i, all.length, generation),
        )

        this.parts = [...mandibles, ...this.wings, ...legs, stinger, ...workers]

        this.scripts.add(() => this.enter(generation))
        this.scripts.add(() => this.phases(generation))
    }

    private *enter(generation: number) {
        if (generation > 0) {
            yield* Charge.burst(this, "#ffd060")
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffe0a0")
                .p(this.p.clone())
                .speed(1.5)
                .radian(this.random() * T)
                .ex(36)
                .g((b) => Behavior.ease(b, "speed", 5.5, 40, Ease.In))
                .fire(this.game.bullets)
        }

        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 180).add(this.home())
        yield
    }

    private *phases(generation: number) {
        this.scripts.add(() => this.ring(generation), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        if (generation > 0) {
            this.scripts.remove("body")
            yield* Charge.gather(this, 150, "#ffd060")

            const escorts = [0, 1, 2, 3, 4, 5].map((i) => new Escort(this.game, this, i))
            this.game.enemies.push(...escorts)
            this.scripts.add(() => this.ring(generation), { loop: Infinity, margin: 60, id: "body" })

            while (escorts.some((p) => p.life > 0)) yield
        }

        this.scripts.remove("body")
        yield* Charge.gather(this, 120, "#ffb040")
        this.isInvincible = false
        this.scripts.add(() => this.fury(generation), { loop: Infinity, id: "body" })
        if (generation > 0) this.scripts.add(() => this.lightWings(), { loop: Infinity, margin: 60, id: "wings" })
    }

    private *ring(generation: number) {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffd060")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(20 + generation * 8)
            .g((b) => (generation > 0 ? Behavior.reaccel(b, 20, 15, 30, 5) : Behavior.accel(b, 1, 3.5)))
            .fire(this.game.bullets)

        yield* Array(150 - generation * 20)
    }

    private *fury(generation: number) {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 80; f += 4) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffb040")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * 0.6 * Math.sin(f / 25))
                .ex(7 + generation * 2)
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(70 - generation * 10)
    }

    private *lightWings() {
        yield* remodel(this)
            .beam(0)
            .color("#e8f0ff")
            .duplicate(8, (b, i) => {
                b.radian = i < 4 ? -0.35 + (i - 1.5) * 0.1 : Math.PI + 0.35 - (i - 5.5) * 0.1
                return b
            })
            .g(function* (b) {
                const base = b.radian
                const side = Math.cos(base) > 0 ? 1 : -1

                b.type = "neutral"
                b.alpha = 0.25
                yield* Behavior.ease(b, "length", 700, 60, Ease.Out)
                b.type = "enemy"
                b.alpha = 1

                for (let f = 0; f < 630; f++) {
                    b.radian = base + side * 0.4 * Math.sin(f / 50)
                    yield
                }

                yield* Behavior.fadeout(b, 30)
            })
            .fire(this.game.bullets)

        yield* remodel(this)
            .beam(0)
            .color("#ffd060")
            .duplicate(6, (b, i) => {
                b.radian = i < 3 ? 0.55 + (i - 1) * 0.1 : Math.PI - 0.55 - (i - 4) * 0.1
                return b
            })
            .g(function* (b) {
                const base = b.radian
                const side = Math.cos(base) > 0 ? 1 : -1

                b.type = "neutral"
                b.alpha = 0.25
                yield* Behavior.ease(b, "length", 700, 60, Ease.Out)
                b.type = "enemy"
                b.alpha = 1

                for (let f = 0; f < 630; f++) {
                    b.radian = base - side * 0.3 * Math.sin(f / 50)
                    yield
                }

                yield* Behavior.fadeout(b, 30)
            })
            .fire(this.game.bullets)

        yield* Array(900)
    }

    snow() {
        this.scripts.add(() => this.snowfall(), { loop: Infinity })
    }

    private *snowfall() {
        yield* remodel(this)
            .format("small-ball")
            .color("#eef6ff")
            .speed(1.4)
            .duplicate(2, (b) => {
                b.p = vec(this.random() * this.game.WIDTH, 0)
                return b
            })
            .appear(20)
            .g(function* (b) {
                const phase = this.random() * T
                for (let f = 0; ; f++) {
                    b.radian = T / 4 + 0.35 * Math.sin(f / 40 + phase)
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(18)
    }
}

namespace Hornet {
    export function* buzz(me: Enemy, radian: number, generation: number) {
        for (let k = 0; k < 10 + generation * 2; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#e8f0ff")
                .p(me.p.clone())
                .speed(4.5)
                .radian(radian)
                .g(function* (b) {
                    const base = b.radian
                    for (let f = 0; ; f++) {
                        b.radian = base + 0.6 * Math.sin(f / 5)
                        yield
                    }
                })
                .fire(me.game.bullets)
            yield* Array(4)
        }

        yield* Array(130)
    }
}

class Mandible extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly generation: number,
    ) {
        super(game, parent, 500, Size.L, 140 + (side > 0 ? 60 : 0))
    }

    protected place() {
        return vec(this.side * 85, 150)
    }

    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffd060")
            .p(this.p.clone())
            .speed(4)
            .radian(this.side > 0 ? 0.35 : Math.PI - 0.35)
            .nway(6 + this.generation * 2, 0.22)
            .g(function* (b) {
                yield* Behavior.stop(b, 22)
                yield* Array(10)
                yield* Behavior.aim(b, this.game.player.p, 6)
                yield* Behavior.accel(b, 15, 8 + this.generation)
            })
            .fire(this.game.bullets)

        yield* Array(120 - this.generation * 20)
    }
}

class SquareWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly row: number,
        private readonly generation: number,
    ) {
        super(game, parent, 300, Size.M, 150 + row * 40 + (side > 0 ? 20 : 0))
    }

    protected place() {
        return vec(this.side * 71, this.row === 0 ? -71 : 71)
    }

    protected *attack() {
        yield* Hornet.buzz(this, T / 4 - this.side * 0.5, this.generation)
    }
}

class HexWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
        private readonly generation: number,
    ) {
        super(game, parent, 300, Size.M, 150 + i * 20)
    }

    protected place() {
        return vec.arg(this.frame / 200 + (T * this.i) / 6).scale(100)
    }

    protected *attack() {
        yield* Hornet.buzz(this, this.p.sub(this.parent.p).radian(), this.generation)
    }
}

class Leg extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly x: number,
        private readonly order: number,
        private readonly generation: number,
    ) {
        super(game, parent, 150, Size.S, 170)
    }

    protected place() {
        return vec(Math.sign(this.x) * (60 + 50 * Math.abs(this.x)), 20)
    }

    protected *attack() {
        yield* Array(this.order * 6)

        yield* remodel(this)
            .format("line")
            .color("#ffe0a0")
            .p(this.p.clone())
            .speed(3)
            .radian(T / 4)
            .nway(4 + this.generation, 0.16)
            .g((b) => Behavior.ease(b, "speed", 7.5 + this.generation, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(140 - this.order * 6)
    }
}

class Stinger extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly generation: number,
    ) {
        super(game, parent, 600, Size.L, 200)
    }

    protected place() {
        return vec(0, 150)
    }

    protected *attack() {
        const start = this.p.clone()
        const aim = this.game.player.p.sub(start).radian()

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ff9060")
            .r(2)
            .speed(0)
            .p(start)
            .radian(aim)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .nway(5 + this.generation * 2, 0.26)
            .g(function* (b, k) {
                yield* Behavior.ease(b, "alpha", 0.2, 8)
                yield* Array(22 + k * 10)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(30)

        for (let k = 0; k < 5 + this.generation * 2; k++) {
            yield* remodel(this)
                .format("line")
                .color("#ff9060")
                .p(start)
                .radian(aim + (k - (4 + this.generation * 2) / 2) * 0.26)
                .speed(13 + this.generation)
                .duplicate(6)
                .delayByIndex(2)
                .fire(this.game.bullets)
        }

        yield* Array(130)
    }
}

class Worker extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
        private readonly count: number,
        private readonly generation: number,
    ) {
        super(game, parent, 180, Size.S, 130)
    }

    protected place() {
        const angle = this.frame / 40 + (T * this.i) / this.count
        return vec(Math.cos(angle) * 180, Math.sin(angle) * 110)
    }

    protected *attack() {
        yield* Array(this.i * 8)

        const before = this.p.clone()
        yield

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffe890")
            .p(this.p.clone())
            .speed(5)
            .radian(this.p.sub(before).radian())
            .duplicate(4 + this.generation)
            .delayByIndex(4)
            .fire(this.game.bullets)

        yield* Array(70 - this.i * 8)
    }
}

class Escort extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 300, Size.M, 60 + i * 10)
    }

    protected place() {
        return vec.arg(-this.frame / 90 + (T * this.i) / 6).scale(120)
    }

    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffd060")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.p.sub(this.parent.p).radian())
            .nway(3, 0.25)
            .g((b) => Behavior.ease(b, "speed", 6.5, 35, Ease.In))
            .fire(this.game.bullets)

        yield* Array(90 + (this.i % 2) * 10)
    }
}
