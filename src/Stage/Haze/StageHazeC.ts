import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Heat } from "./Heat"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = Heat.PLUME_TOTAL_FRAMES + 360
const PLUMES = 6

const SPARK_LIFE = 1200

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemySpark(this.game, master, -1), new EnemySpark(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        super(game, SPARK_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            plumes: Heat.plumes(this, PLUMES, []),
            wait: Array(CYCLE_FRAMES),
        })
    }
}

class EnemySpark extends Enemy {
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, SPARK_LIFE, Size.S)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.3, game.HEIGHT * 0.04 * Math.sin(this.frame / 100)))

        this.scripts.add(() => this.cycle(), {
            margin: ENTRANCE_FRAMES + Heat.SEED_FRAMES + (side > 0 ? 45 : 0),
            loop: Infinity,
        })
    }

    private *cycle() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffe0b0")
            .p(this.p.clone())
            .aim(this.game.player)
            .nway(3, T / 20)
            .delayByIndex()
            .speed(4)
            .g(function* (me, i) {
                yield* Behavior.reaccel(me, 30, 30 - i, 30)
            })
            .fire(this.game.bullets)

        yield* Array(90)
    }
}
