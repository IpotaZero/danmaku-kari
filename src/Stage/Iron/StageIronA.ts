import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Shield } from "./Shield"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const RING: Shield.RingConfig = { radius: 84, slots: 21, windowSlots: 4, spin: T / 720 }

const FIRE_FRAMES = 90
const REST_FRAMES = 110
const STREAM_INTERVAL = 5
const STREAM_SPEED = 3.5
const COLOR: Color = "#9ab8ff"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)
    private readonly ring = new Shield.Ring(this, RING, this.random() * T)

    constructor(game: Game) {
        super(game, 1200, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.ring.build().fire(this.game.bullets))
        this.scripts.add(() => this.cycle(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            stream: this.stream(),
            ring: this.burst(),
            wait: Array(FIRE_FRAMES + REST_FRAMES),
        })
    }

    private *stream() {
        for (let f = 0; f < FIRE_FRAMES; f += STREAM_INTERVAL) {
            const angle = this.ring.angle()

            yield* remodel(this)
                .format("diamond")
                .color(COLOR)
                .speed(STREAM_SPEED)
                .duplicate(2, (b, k) => {
                    b.p = this.ring.window(k)
                    b.radian = angle + (k * T) / 2
                    return b
                })
                .nway(2, T / 4)
                .nway(3, T / 40)
                .fire(this.game.bullets)

            yield* Array(STREAM_INTERVAL)
        }
    }

    private *burst() {
        yield* Array(FIRE_FRAMES + 20)

        yield* remodel(this)
            .format("small-ball")
            .color("#e0e8ff")
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(63)
            .g((me) => Behavior.appear(me, 20))
            .fire(this.game.bullets)
    }
}
