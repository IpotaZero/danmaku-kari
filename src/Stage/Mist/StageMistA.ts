import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mist } from "./Mist"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 560

const RING_FRAMES = 200
const RING_INTERVAL = 20

const RING_COUNT = 31
const RING_SPEED = 2.2

const CLOCK = new Mist.Clock(360, 36)
const COLORS: Color[] = ["#ffb0d0", "#a0c8ff"]

const LANTERN_LIFE = 700

export default class extends Stage {
    *G() {
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, new EnemyLantern(this.game, pupil, 0), new EnemyLantern(this.game, pupil, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 1, 2)

    constructor(game: Game) {
        super(game, LANTERN_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            arrows: this.arrows(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *arrows() {
        for (let k = 0; k < 3; k++) {
            yield* Array(80)

            yield* remodel(this)
                .format("arrow")
                .color("#ffffff")
                .p(this.p.clone())
                .speed(0.5)
                .aim(this.game.player)
                .nway(3, T / 16)
                .g((me) => Behavior.accel(me, 60, 8))
                .fire(this.game.bullets)
        }
    }
}

class EnemyLantern extends Enemy {
    constructor(game: Game, parent: Enemy, phase: number) {
        super(game, LANTERN_LIFE, Size.S)

        const side = phase === 0 ? -1 : 1
        this.setParent(parent, () =>
            vec(side * game.WIDTH * 0.3, game.HEIGHT * 0.05 * Math.sin(this.frame / 120 + phase)),
        )

        this.scripts.add(() => this.cycle(phase), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(phase: number) {
        yield* GenUtils.all({
            rings: this.rings(phase),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *rings(phase: number) {
        for (let k = 0; k < RING_FRAMES / RING_INTERVAL; k++) {
            yield* remodel(this)
                .format("diamond")
                .color(COLORS[phase])
                .p(this.p.clone())
                .speed(RING_SPEED)
                .radian(this.random() * T)
                .ex(RING_COUNT)
                .g(function* (me) {
                    yield* CLOCK.follow(me, phase, this.frame)
                })
                .fire(this.game.bullets)

            yield* Array(RING_INTERVAL)
        }
    }
}
