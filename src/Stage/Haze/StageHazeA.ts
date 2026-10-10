import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mirage } from "./Mirage"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const DRAW_FRAMES = 60

const CYCLE_FRAMES = 480

const RINGS = 3
const RING_INTERVAL = 40
const RING_COUNT = 20
const RING_SPEED = 1.8

const SHIMMER = 0.35
const SHIMMER_PERIOD = 20
const COLOR: Color = "#ffb070"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.2, 3, 4)
    private readonly mirror = Mirage.vertical(this.game)

    constructor(game: Game) {
        super(game, 3000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        Mirage.show(this, [this.mirror], DRAW_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity, margin: DRAW_FRAMES + 30 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 600).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *rings() {
        for (let k = 0; k < RINGS; k++) {
            const sign = k % 2 === 0 ? 1 : -1

            yield* remodel(this)
                .format("diamond")
                .color(COLOR)
                .p(this.p.clone())
                .speed(RING_SPEED)
                .radian(this.random() * T)
                .ex(RING_COUNT)
                .g(function* (me) {
                    const base = me.radian

                    for (let f = 0; ; f++) {
                        me.radian = base + sign * SHIMMER * Math.sin(f / SHIMMER_PERIOD)
                        yield
                    }
                })
                .mirrorAll([this.mirror])
                .fire(this.game.bullets)

            yield* Array(RING_INTERVAL)
        }
    }
}
