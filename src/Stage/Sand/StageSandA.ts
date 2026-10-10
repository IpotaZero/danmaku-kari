import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Sand } from "./Sand"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const BAND: Sand.Band = {
    rows: 8,
    rowGap: 80,
    speed: 1.6,
    spacing: 10,
    segment: [90, 170],
    gap: [70, 110],
    flow: [1.2, 2.8],
}

const CYCLE_FRAMES = 900

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.1, 8, 13)

    constructor(game: Game) {
        super(game, 3000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 300).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            storm: this.storm(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *storm() {
        yield* Sand.storm(this, BAND)

        yield* Array(Math.floor(Sand.travelFrames(this, BAND) * 0.45))

        for (let i = 0; i < 13; i++) {
            yield* remodel(this)
                .format("diamond")
                .color("#fff0d0")
                .p(this.p.clone())
                .speed(1)
                .aim(this.game.player)
                .nway(5, T / 20)
                .g(function* (me) {
                    yield* Behavior.accel(me, 60, 8)
                })
                .fire(this.game.bullets)

            yield* Array(30)
        }
    }
}
