import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const LOWER_FRAMES = 60
const SWING_FRAMES = 600
const FADE_FRAMES = 30

const CYCLE_FRAMES = LOWER_FRAMES + SWING_FRAMES + FADE_FRAMES + 180

const LINK_SPACING = 16
const MISSING = 3

const LENGTH = 0.82
const AMPLITUDE = (T / 360) * 35

const PERIODS = [250, 310]
const COLOR: Color = "#e8d0ff"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyMaster(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.03, 1, 2)

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
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        const width = this.game.WIDTH

        yield* GenUtils.all({
            left: this.pendulum(vec(width * 0.25, 0), PERIODS[0], -1),
            right: this.pendulum(vec(width * 0.75, 0), PERIODS[1], 1),
            rings: (function* (me: EnemyMaster) {
                for (let k = 0; k < 3; k++) {
                    yield* Array(LOWER_FRAMES + 150)

                    yield* remodel(me)
                        .format("donut")
                        .color("#ffffff")
                        .p(me.p.clone())
                        .speed(1.3)
                        .radian(me.random() * T)
                        .ex(14)
                        .g((b) => Behavior.appear(b, 20))
                        .fire(me.game.bullets)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *pendulum(pivot: Vec, period: number, side: number) {
        const length = this.game.HEIGHT * LENGTH
        const links = Math.floor(length / LINK_SPACING)

        const missing = Math.floor(links * (0.5 + 0.35 * this.random()))
        const distances = Array.from({ length: links }, (_, i) => (i + 1) * LINK_SPACING).filter(
            (_, i) => i < missing || missing + MISSING <= i,
        )
        const angle = (f: number) => side * AMPLITUDE * Math.cos((T * f) / period)
        const at = (d: number, f: number) => pivot.add(vec.arg(T / 4 + angle(f)).scale(d))

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color(COLOR)
            .speed(0)
            .duplicate(distances.length + 1, (b, i) => {
                if (i === distances.length) b.r = 24
                b.p = pivot.clone()
                return b
            })
            .unbounded()
            .g(function* (me, i) {
                const d = i < distances.length ? distances[i] : length + 16

                me.type = "neutral"
                me.alpha = 0.3

                for (let f = 1; f <= LOWER_FRAMES; f++) {
                    const t = f / LOWER_FRAMES
                    me.p = pivot.add(vec.arg(T / 4 + angle(0) * t).scale(d * Math.min(1, t * 1.5)))
                    yield
                }

                me.type = "enemy"
                me.alpha = 1

                for (let f = 0; f < SWING_FRAMES; f++) {
                    me.p = at(d, f)
                    yield
                }

                yield* Behavior.fadeout(me, FADE_FRAMES)
            })
            .fire(this.game.bullets)
    }
}
