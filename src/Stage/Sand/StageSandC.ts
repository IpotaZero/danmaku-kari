import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
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
        this.game.enemies.push(master, ...master.ants)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.05, 2, 3)

    readonly ants = [0, 1, 2, 3, 4, 5].map((i) => new Ant(this.game, this, i))

    constructor(game: Game) {
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.watchAnts(), { margin: 120 })
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.shower(), { loop: Infinity, margin: 40 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 250).add(this.home())
        yield
    }

    private *watchAnts() {
        const alive = new Set(this.ants)

        while (this.life > 0) {
            for (const ant of alive) {
                if (ant.life > 0) continue
                alive.delete(ant)

                yield* remodel(this)
                    .format("small-ball")
                    .r(5)
                    .color("#ffe8b8")
                    .p(ant.p.clone())
                    .speed(2.2)
                    .radian(this.random() * T)
                    .ex(14)
                    .fire(this.game.bullets)
            }

            yield
        }
    }

    private *shower() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffc870")
            .p(this.p.clone())
            .speed(4)
            .radian(T / 4 + (this.random() - 0.5) * 0.2)
            .nway(21, T / 32)
            .g((me) => Behavior.reaccel(me, 20, 20, 40, 5.5))
            .fire(this.game.bullets)

        yield* Array(130)
    }
}

class Ant extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 300, Size.S, 140 + i * 13)
    }

    protected place() {
        return vec(
            this.game.WIDTH / 2 + this.game.WIDTH * 0.4 * Math.cos(this.frame / 110 + (T * this.i) / 6),
            this.game.HEIGHT * 0.45 + this.game.HEIGHT * 0.07 * Math.sin(this.frame / 110 + (T * this.i) / 6),
        ).sub(this.parent.p)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#ffd890")
            .p(this.p.clone())
            .speed(1.2)
            .aim(this.game.player)
            .nway(3, T / 16)
            .g((b) => Behavior.ease(b, "speed", 6, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(85)
    }
}
