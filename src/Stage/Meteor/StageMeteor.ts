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
import { Meteor } from "./Meteor"
import { Charge } from "../Charge"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const boss = new EnemyHotaru(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyHotaru extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.08, 2, 3)

    private readonly lantern = new Lantern(this.game, this)
    private readonly antennae = [-1, 1].map((side) => new Antenna(this.game, this, side))
    private readonly fireflies = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new Firefly(this.game, this, i))

    readonly parts = [this.lantern, ...this.antennae, ...this.fireflies]

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.lantern.life > 0) yield

        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#d8ff90")

        const bigs = [-165, -55, 55, 165].map((x, i) => {
            const big = new BigFirefly(this.game, this, x, i)
            const grandchildren = [0, 1].map((k) => new LittleFirefly(this.game, big, k))
            big.guardedBy(grandchildren)
            this.game.enemies.push(big, ...grandchildren)
            return big
        })

        this.scripts.add(() => this.meteorFan(), { loop: Infinity, margin: 60, id: "body" })
        while (bigs.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        this.isInvincible = false
        this.game.camera.shake(8, 30)
        this.scripts.add(() => this.lastLight(), { loop: Infinity, margin: 30, id: "body" })
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffffc0")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(20)
            .fire(this.game.bullets)

        yield* Array(160)
    }

    private *meteorFan() {
        const sway = (this.random() - 0.5) * 0.6

        for (const k of [0, 1, 2, 3]) {
            this.scripts.add(
                () =>
                    Meteor.fall(this, this.p.clone(), T / 4 + sway + (k - 1.5) * 0.5, {
                        preview: 40,
                        speed: 16,
                        tailInterval: 2,
                        tailLife: 36,
                        color: "#ffffc0",
                    }),
                { margin: k * 6 },
            )
        }

        yield* Array(150)
    }

    private *lastLight() {
        const aim = this.game.player.p.sub(this.p).radian()

        for (const k of [0, -1, 1]) {
            this.scripts.add(
                () =>
                    Meteor.fall(this, this.p.clone(), aim + k * 0.4, {
                        preview: 40,
                        speed: 18,
                        tailInterval: 2,
                        tailLife: 30,
                        color: "#ffffe0",
                    }),
                { margin: (k + 1) * 6 },
            )
        }

        yield* Array(60)

        yield* remodel(this)
            .format("diamond")
            .color("#ffffc0")
            .p(this.p.clone())
            .speed(5)
            .radian(this.random() * T)
            .ex(30)
            .g((b) => Behavior.reaccel(b, 20, 20, 30, 5.5))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}

class Lantern extends Part {
    constructor(game: Game, parent: Enemy) {
        super(game, parent, 900, Size.L, 150)
    }

    protected place() {
        return vec(0, 80)
    }

    protected *attack() {
        const aim = this.game.player.p.sub(this.p).radian()

        for (const k of [0, -1, 1]) {
            this.scripts.add(
                () =>
                    Meteor.fall(this, this.p.clone(), aim + k * 0.45, {
                        preview: 45,
                        speed: 16,
                        tailInterval: 2,
                        tailLife: 36,
                        color: "#d8ff90",
                    }),
                { margin: (k + 1) * 8 },
            )
        }

        yield* Array(170)
    }
}

class Antenna extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 350, Size.M, 130 + (side > 0 ? 30 : 0))
    }

    protected place() {
        return vec(this.side * 100, 0)
    }

    protected *attack() {
        yield* remodel(this)
            .format("line")
            .color("#f0ffc0")
            .p(this.p.clone())
            .speed(2)
            .aim(this.game.player)
            .duplicate(5)
            .delayByIndex(4)
            .g((b) => Behavior.ease(b, "speed", 8, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(60)
    }
}

class Firefly extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 200, Size.S, 160)
    }

    protected place() {
        return vec.arg(this.frame / 120 + (T * this.i) / 8).scale(160)
    }

    protected *attack() {
        yield* Array(this.i * 10)

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#d8ff90")
            .p(this.p.clone())
            .speed(0)
            .radian(this.random() * T)
            .ex(7)
            .forEach((b) => {
                b.p = b.p.add(vec.arg(b.radian).scale(14))
            })
            .appear(10)
            .g(function* (b) {
                yield* Array(25)
                yield* Behavior.accel(b, 20, 5.5)
            })
            .fire(this.game.bullets)

        yield* Array(240 - this.i * 10)
    }
}

class BigFirefly extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly x: number,
        i: number,
    ) {
        super(game, parent, 280, Size.M, 60 + i * 20)
    }

    protected place() {
        return vec(this.x, 200)
    }

    protected *attack() {
        for (let f = 0; f < 60; f += 4) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#e8ffb0")
                .p(this.p.add(vec(-42 + f * 1.4, 0)))
                .speed(0)
                .radian(T / 4)
                .appear(10)
                .g(function* (b) {
                    yield* Array(80 - f)
                    yield* Behavior.accel(b, 30, 4.5)
                })
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(160)
    }
}

class LittleFirefly extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 90, Size.S, 70 + k * 50)
    }

    protected place() {
        return vec.arg(this.frame / 30 + this.k * Math.PI).scale(56)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(4)
            .color("#f0ffd0")
            .p(this.p.clone())
            .speed(3)
            .radian(this.random() * T)
            .ex(6)
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
