import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.sprayers)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 2, 3)

    readonly sprayers = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
    ].map(([side, row]) => new Sprayer(this.game, this, side, row))

    constructor(game: Game) {
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 400).add(this.home())
        yield
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffb0d0")
            .p(this.p.clone())
            .speed(5)
            .radian(this.random() * T)
            .ex(36)
            .g((me) => Behavior.reaccel(me, 25, 25, 30, 5))
            .fire(this.game.bullets)

        yield* Array(110)
    }
}

class Sprayer extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly row: number,
    ) {
        super(game, parent, 450, Size.S, 150 + row * 120)
    }

    protected place() {
        return vec(
            this.game.WIDTH / 2 + this.side * this.game.WIDTH * 0.44,
            this.game.HEIGHT * (0.26 + 0.22 * this.row),
        )
            .add(vec(0, 20 * Math.sin(this.frame / 40)))
            .sub(this.parent.p)
    }

    protected *attack() {
        const inward = this.side < 0 ? 0 : T / 2
        const tilt = this.row === 0 ? 0.55 : -0.1

        for (let f = 0; f < 150; f += 4) {
            const swing = Math.sin((T * f) / 120) * 0.75

            yield* remodel(this)
                .format("diamond")
                .color("#d8e0ff")
                .p(this.p.clone())
                .speed(6)
                .radian(inward - this.side * (tilt + swing))
                .fire(this.game.bullets)

            yield* Array(4)
        }

        yield* Array(210)
    }
}
