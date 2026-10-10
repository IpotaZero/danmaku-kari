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

const CYCLE_FRAMES = 470

const THROW_SPEED = 3.5

const MAX_THROW_FRAMES = 150

const GROW_FRAMES = 50

const SHATTER_FRAMES = MAX_THROW_FRAMES + GROW_FRAMES + 20
const SHATTER_SPEED = 3.5

const CRYSTAL_SPACING = 16

const ARM_LENGTH = 6
const BRANCH_AT = [3, 5]
const BRANCH_LENGTH = 2

const FLAKE_LIFE = 500

export default class extends Stage {
    *G() {
        const boss = new EnemyMaster(this.game)
        this.game.enemies.push(boss, new EnemyFlake(this.game, boss, -1), new EnemyFlake(this.game, boss, 1))

        yield* this.waitAllEnemiesDead()
    }
}

function crystal(base: number): Vec[] {
    const result: Vec[] = []

    for (let k = 0; k < 6; k++) {
        const arm = base + (T / 6) * k

        for (let i = 1; i <= ARM_LENGTH; i++) {
            result.push(vec.arg(arm).scale(CRYSTAL_SPACING * i))
        }

        for (const at of BRANCH_AT) {
            const root = vec.arg(arm).scale(CRYSTAL_SPACING * at)

            for (const side of [-1, 1]) {
                for (let j = 1; j <= BRANCH_LENGTH; j++) {
                    result.push(root.add(vec.arg(arm + (side * T) / 6).scale(CRYSTAL_SPACING * j)))
                }
            }
        }
    }

    return result
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.4, 4, 7)

    constructor(game: Game) {
        super(game, FLAKE_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.4)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 600).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            icicle: this.icicle(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *icicle() {
        yield* Array(SHATTER_FRAMES)

        yield* remodel(this)
            .format("arrow")
            .color("#bfe9ff")
            .p(this.p.clone())
            .aim(this.game.player)
            .duplicate(3, (me, i) => {
                me.radian = T * (i / 3)
                me.speed = 4 + 4 * (i / 3)
                return me
            })
            .ex(13)
            .g((me) => Behavior.reaccel(me, 30, 60, 60, 6))
            .fire(this.game.bullets)
    }
}

class EnemyFlake extends Enemy {
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, FLAKE_LIFE, Size.S)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.3, game.HEIGHT * 0.03 * Math.sin(this.frame / 200)))

        this.scripts.add(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            snowflake: this.snowflake(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *snowflake(side: number) {
        if (this.life <= 0) return

        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const center = vec(width * (0.5 + side * (0.1 + this.random() * 0.25)), height * (0.45 + this.random() * 0.25))

        const throwFrames = Math.min(Math.ceil(center.sub(this.p).magnitude() / THROW_SPEED), MAX_THROW_FRAMES)

        yield* this.seed(center, throwFrames)
        yield* this.grow(center, throwFrames)
    }

    private *seed(center: Vec, throwFrames: number) {
        yield* remodel(this)
            .format("diamond")
            .color("#dff6ff")
            .p(this.p.clone())
            .g(function* (me) {
                yield* Behavior.throwTo(me, center, throwFrames)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(this.game.bullets)

        yield* Array(throwFrames)
    }

    private *grow(center: Vec, throwFrames: number) {
        const offsets = crystal(this.random() * T)
        const maxDistance = Math.max(...offsets.map((o) => o.magnitude()))

        yield* remodel(this)
            .format("small-ball")
            .color("#8fd8ff")
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = center.add(offsets[i])
                b.radian = offsets[i].radian()
                b.delay = Math.floor((offsets[i].magnitude() / maxDistance) * GROW_FRAMES)
                return b
            })
            .g(function* (me) {
                const appearFrames = 12

                yield* Behavior.appear(me, appearFrames)
                yield* Array(Math.max(0, SHATTER_FRAMES - throwFrames - me.delay - appearFrames))

                me.color = "#dff6ff"
                yield* Behavior.accel(me, 30, SHATTER_SPEED)
            })
            .fire(this.game.bullets)
    }
}
