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
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const boss = new EnemyKagerou(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.parts.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyKagerou extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.08, 2, 3)

    private readonly foreWings = [-1, 1].map((side) => new ForeWing(this.game, this, side))
    private readonly hindWings = [-1, 1].map((side) => new HindWing(this.game, this, side))
    private readonly tails = [-1, 0, 1].map((k) => new Tail(this.game, this, k))

    readonly parts = [...this.foreWings, ...this.hindWings, ...this.tails]

    constructor(game: Game) {
        super(game, 2400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.17)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 350).add(this.home())
        yield
    }

    private *ring() {
        const lost = this.parts.filter((p) => p.life <= 0).length
        const bare = lost === this.parts.length

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffb0d0")
            .p(this.p.clone())
            .speed(bare ? 5 : 3)
            .radian(this.random() * T)
            .ex(16 + lost * 4)
            .g((b) => (bare ? Behavior.reaccel(b, 20, 20, 30, 5.5) : Behavior.accel(b, 1, 3)))
            .fire(this.game.bullets)

        yield* Array(bare ? 60 : 120)
    }
}

class ForeWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 380, Size.M, 150 + (side > 0 ? 35 : 0))
    }

    protected place() {
        return vec.arg(this.frame / 200 + (this.side > 0 ? 0 : Math.PI)).scale(100)
    }

    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#e0e8ff")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.p.sub(this.parent.p).radian())
            .nway(7, T / 30)
            .g((b) => Behavior.ease(b, "speed", 7, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }
}

class HindWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 380, Size.M, 180 + (side > 0 ? 30 : 0))
    }

    protected place() {
        return vec.arg(this.frame / 200 + (this.side > 0 ? T / 4 : -T / 4)).scale(100)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#fff0d0")
            .p(this.p.clone())
            .speed(0)
            .duplicate(10)
            .scatter({ p: 40 })
            .appear(15)
            .g(function* (b) {
                yield* Array(30)
                b.radian = T / 4 + (this.random() - 0.5) * 0.8
                yield* Behavior.accel(b, 40, 2.5 + this.random() * 2)
            })
            .fire(this.game.bullets)

        yield* Array(60)
    }
}

class Tail extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 300, Size.M, 160 + (k + 1) * 25)
    }

    protected place() {
        return vec(this.k * 70, 150)
    }

    protected *attack() {
        for (let f = 0; f < 70; f += 4) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#c8d0f0")
                .p(this.p.clone())
                .speed(5.5)
                .radian(T / 4 + 0.6 * Math.sin(this.frame / 20 + this.k))
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(110)
    }
}
