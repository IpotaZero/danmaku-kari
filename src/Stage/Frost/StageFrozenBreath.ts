import { vec } from "@ipota/vec"
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

const CYCLE_FRAMES = 480

const SPREAD_FRAMES = 40

const FREEZE_FRAMES = 20

const DROP_FRAMES = 150

const SHARDS_PER_RING = 24

const RING_COUNT = 4
const INNER_SPEED = 2
const OUTER_SPEED = 6

const DROP_SPEED = 4

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.05, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.25)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            breath: this.breath(),
            icicle: this.icicle(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *breath() {
        const base = this.random() * T

        yield* remodel(this)
            .appearance("ball")
            .color("#dff6ff")
            .p(this.p.clone())
            .r(4)
            .radian(base)
            .ex(SHARDS_PER_RING)
            .duplicate(RING_COUNT, (b, i) => {
                b.speed = INNER_SPEED + ((OUTER_SPEED - INNER_SPEED) * i) / (RING_COUNT - 1)
                b.radian += (i % 2) * (T / SHARDS_PER_RING / 2)
                return b
            })
            .g(function* (me) {
                yield* Array(SPREAD_FRAMES)
                yield* Behavior.stop(me, FREEZE_FRAMES)

                me.color = "#2bb5ff"
                yield* Array(DROP_FRAMES - SPREAD_FRAMES - FREEZE_FRAMES)

                me.radian = T / 4
                yield* Behavior.accel(me, 60, DROP_SPEED)
            })
            .fire(this.game.bullets)
    }

    private *icicle() {
        yield* Array(SPREAD_FRAMES + FREEZE_FRAMES + 10)
        if (this.life <= 0) return

        yield* remodel(this)
            .format("diamond")
            .color("#bfe9ff")
            .p(this.p.clone())
            .speed(2.5)
            .aim(this.game.player)
            .nway(7, T / 20)
            .fire(this.game.bullets)
    }
}
