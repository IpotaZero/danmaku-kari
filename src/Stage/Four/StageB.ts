import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
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
    private readonly paws = [-1, 1].map((side) => new Paw(this.game, this, side))
    private readonly hindLegs = [-1, 1].map((side) => new HindLeg(this.game, this, side))
    private readonly tail = new Tail(this.game, this)
    private readonly cubs = [0, 1, 2].map((k) => new Cub(this.game, this, k))

    private readonly guards = [...this.paws, this.tail]
    readonly parts = [...this.paws, ...this.hindLegs, this.tail, ...this.cubs]

    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16), 120)

        this.scripts.add(() => this.pounce(), { loop: Infinity, id: "move" })
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.scripts.remove("move")
        yield* Charge.gather(this, 150, "#f0f0ff")
        this.scripts.add(() => this.pounce(), { loop: Infinity, id: "move" })

        const youngs = [-1, 1].map((side) => {
            const young = new Young(this.game, this, side)
            const claw = new YoungClaw(this.game, young, side)
            young.guardedBy([claw])
            this.game.enemies.push(young, claw)
            return young
        })

        this.scripts.add(() => this.roar(), { loop: Infinity, margin: 90, id: "body" })
        while (youngs.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.scripts.remove("move")
        yield* Charge.gather(this, 120, "#ff7070")
        this.isInvincible = false
        this.scripts.add(() => this.gale(), { loop: Infinity, id: "move" })
        this.scripts.add(() => Tiger.claw(this), { loop: Infinity, margin: 30, id: "claw" })
        this.scripts.add(() => Tiger.stripes(this), { loop: Infinity, margin: 90, id: "stripes" })
        this.scripts.add(() => this.roar(), { loop: Infinity, margin: 60, id: "body" })
    }

    private *pounce() {
        yield* Array(55)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.12 * this.random())),
            22,
        )
    }

    private *gale() {
        yield* Array(20)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.14 * this.random())),
            12,
        )

        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(2)
            .radian(this.random() * T)
            .ex(40)
            .g((b) => Behavior.ease(b, "speed", 6.5, 30, Ease.In))
            .fire(this.game.bullets)
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffffff")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(24)
            .fire(this.game.bullets)

        yield* Array(120)
    }

    private *roar() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .radian(this.random() * T)
            .ex(28)
            .duplicate(3, (b, k) => {
                b.radian += (k * T) / 84
                b.speed = 3.5 + k
                return b
            })
            .fire(this.game.bullets)

        yield* Array(80)
    }
}

namespace Tiger {
    export function* claw(me: Enemy) {
        const start = me.p.clone()
        const aim = me.game.player.p.sub(start).radian()

        yield* remodel(me)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ffffff")
            .r(2)
            .speed(0)
            .p(start)
            .radian(aim)
            .length(me.game.WIDTH + me.game.HEIGHT)
            .alpha(0)
            .shift(4, 22)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.1, 8)
                yield* Array(20)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(me.game.bullets)

        yield* Array(28)

        yield* remodel(me)
            .format("line")
            .color("#ffffff")
            .p(start)
            .radian(aim)
            .speed(24)
            .duplicate(6)
            .delayByIndex(3)
            .shift(4, 22)
            .fire(me.game.bullets)

        yield* Array(62)
    }

    export function* stripes(me: Enemy) {
        const sway = (me.random() - 0.5) * 0.6

        for (let k = 0; k < 5; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#f0f0f0")
                .p(me.p.clone())
                .speed(5.5)
                .radian(T / 4 + sway + (k - 2) * 0.12)
                .shift(11, 24)
                .fire(me.game.bullets)
            yield* Array(14)
        }

        yield* Array(140)
    }
}

class Paw extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 500, Size.L, 140 + (side > 0 ? 55 : 0))
    }

    protected place() {
        return vec.arg(T / 4 - (this.side * T) / 10).scale(100)
    }

    protected *attack() {
        yield* Tiger.claw(this)
    }
}

class HindLeg extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 350, Size.M, 170 + (side > 0 ? 45 : 0))
    }

    protected place() {
        return vec.arg(-T / 4 + (this.side * T) / 5).scale(100)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#d0e8ff")
            .p(this.p.clone())
            .speed(6.5)
            .radian(this.side > 0 ? 0 : Math.PI)
            .duplicate(8)
            .delayByIndex(4)
            .nway(3, 0.22)
            .unbounded()
            .g(function* (b) {
                yield* Behavior.rotating(b, this.side * 0.045, 35)

                while (b.p.y < b.game.HEIGHT + 20) yield
                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }
}

class Tail extends Part {
    constructor(game: Game, parent: Enemy) {
        super(game, parent, 600, Size.L, 200)
    }

    protected place() {
        return vec(0, -100)
    }

    protected *attack() {
        yield* Tiger.stripes(this)
    }
}

class Cub extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 180, Size.S, 150 + k * 30)
    }

    protected place() {
        return vec((this.k - 1) * 60, 160)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#fff0d0")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.random() * T)
            .ex(12)
            .g((b) => Behavior.ease(b, "speed", 5.5, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(75)
    }
}

class Young extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 350, Size.M, 60 + (side > 0 ? 50 : 0))
    }

    protected place() {
        return vec(this.side * 115, 60)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#f0f0ff")
            .p(this.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(20)
            .g((b) => Behavior.reaccel(b, 20, 20, 30, 5.5))
            .fire(this.game.bullets)

        yield* Array(90)
    }
}

class YoungClaw extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 100, Size.S, 80)
    }

    protected place() {
        return vec.arg(this.frame / 50 + (this.side > 0 ? 0 : Math.PI)).scale(60)
    }

    protected *attack() {
        yield* remodel(this)
            .format("line")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(3)
            .radian(T / 4)
            .duplicate(5)
            .delayByIndex(3)
            .shift(3, 16)
            .g((b) => Behavior.ease(b, "speed", 9, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }
}
