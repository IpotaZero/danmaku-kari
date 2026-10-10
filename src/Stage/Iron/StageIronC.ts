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
        this.game.enemies.push(master, ...master.guards)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    readonly guards = [0, 1, 2, 3, 4].map((i) => new ShieldBearer(this.game, this, i))

    constructor(game: Game) {
        super(game, 800, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.fan(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 300).add(this.home())
        yield
    }

    private *fan() {
        yield* remodel(this)
            .format("diamond")
            .color("#9ab8ff")
            .p(this.p.clone())
            .speed(5)
            .radian(T / 4 + (this.random() - 0.5) * 0.3)
            .nway(25, T / 36)
            .g((me) => Behavior.reaccel(me, 25, 15, 40, 6.5))
            .fire(this.game.bullets)

        yield* Array(75)
    }
}

class ShieldBearer extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 500, Size.S, 150 + i * 18)
    }

    protected place() {
        return vec.arg(T / 4 + (this.i - 2) * 0.42 + 0.35 * Math.sin(this.frame / 70)).scale(120)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#c8d4e8")
            .p(this.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(12)
            .g((b) => Behavior.reaccel(b, 15, 20, 30, 5))
            .fire(this.game.bullets)

        yield* Array(90)
    }
}
