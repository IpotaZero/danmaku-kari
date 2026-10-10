import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Curves } from "../../utils/Functions/Curves"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 420

const HEXAGON_COUNT = 3
const DROP_INTERVAL = 52

const HEXAGON_RADIUS = 64

const HEXAGON_SPACING = 32
const FALL_SPEED = 1.6

const SPIN = T / 600

export default class extends Stage {
    *G() {
        const parent = new EnemyHexagon(this.game)
        this.game.enemies.push(parent, new EnemySnow(this.game, parent), new EnemyLine(this.game, parent))

        yield* this.waitAllEnemiesDead()
    }
}

function hexagon(radius: number): Vec[] {
    const vertices = [0, 1, 2, 3, 4, 5].map((k) => vec.arg((T * k) / 6).scale(radius))
    const perSide = Math.round((radius * Math.sqrt(3)) / HEXAGON_SPACING)
    const result: Vec[] = []

    for (let k = 0; k < 6; k++) {
        const from = vertices[k]
        const edge = vertices[(k + 1) % 6].sub(from)

        for (let j = 0; j < perSide; j++) {
            result.push(from.add(edge.scale(j / perSide)))
        }
    }

    return result
}

class EnemyLine extends Enemy {
    constructor(game: Game, parent: Enemy) {
        super(game, 750, Size.S)
        this.setParent(parent, () => vec.arg(T / 2 + (T / 180) * this.frame).scale(parent.r))
        this.scripts.add(() => this.line(), { loop: Infinity, margin: 240 })
    }

    private *line() {
        yield* Array(140)
        yield* remodel(this)
            .format("line")
            .color("#ffbfbf")
            .r(28)
            .g(function* (me) {
                yield* Behavior.reaccel(me, 20, 40, 30, 14)
            })
            .p(this.p)
            .speed(4)
            .aim(this.game.player)
            .nway(3, T / 24)
            .fire(this.game.bullets)
        yield
    }
}

class EnemySnow extends Enemy {
    constructor(game: Game, parent: Enemy) {
        super(game, 750, Size.S)
        this.setParent(parent, () => vec.arg((T / 180) * this.frame).scale(parent.r))
        this.scripts.add(() => this.snow(), { loop: Infinity, margin: 120 })
    }

    private *snow() {
        yield* Array(128)
        yield* remodel(this)
            .format("diamond")
            .color("#bfe9ff")
            .duplicate(12, (b, i) => {
                b.p = vec(
                    (this.game.WIDTH / 11) * i - this.random() * 32 + 10000 * Math.floor(this.random() * 2),
                    this.random() * 16,
                )
                return b
            })
            .scatter({ speed: [2, 3] })
            .radian(T / 4)
            .fire(this.game.bullets)
        yield
    }
}

class EnemyHexagon extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        super(game, 1500, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 60).add(this.home())
        yield
    }

    private *cycle() {
        const lanes = [0, 1, 2].sort(() => this.random() - 0.5)

        yield* GenUtils.all({
            drop: (function* (me: EnemyHexagon) {
                for (let k = 0; k < HEXAGON_COUNT; k++) {
                    yield* me.drop(lanes[k % lanes.length], k % 2 === 0 ? 1 : -1)
                    yield* Array(DROP_INTERVAL)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *drop(lane: number, direction: number) {
        const width = this.game.WIDTH

        const laneWidth = (width - HEXAGON_RADIUS * 2) / 3
        const center = vec(HEXAGON_RADIUS + laneWidth * (lane + 0.2 + this.random() * 0.6), HEXAGON_RADIUS + 8)
        const offsets = hexagon(HEXAGON_RADIUS)

        yield* remodel(this)
            .format("small-ball")
            .color("#bfe9ff")
            .duplicate(offsets.length, (b, i) => {
                b.p = center.add(offsets[i])
                return b
            })
            .g((me, i) => Behavior.revolve(me, center, offsets[i], vec(0, FALL_SPEED), SPIN * direction))

            .appear(12, 1)
            .fire(this.game.bullets)
    }
}
