import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { SpiderWeb } from "./SpiderWeb"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 400

const THROW_INTERVAL = 30

const FLIGHT_FRAMES = 60
const LAND_FRAMES = 40

const SOLID_FRAMES = 150

const WEB: SpiderWeb.Config = {
    spokes: 8,
    rings: 4,
    ringGap: 30,
    spacing: 14,
    flightFrames: FLIGHT_FRAMES,
    landFrames: LAND_FRAMES,
    solidFrames: SOLID_FRAMES,
}

const AIM_SPREAD = 80

const SPIDER_COUNT = 3
const SPIDER_LIFE = 600

const THREAD_INTERVAL = 3
const THREAD_SPEED = 4

const THREAD_FRAMES = 90
const THREAD_GAP_FRAMES = 30
const DANGLER_LIFE = 500

export default class extends Stage {
    *G() {
        const core = new EnemyMother(this.game)
        this.game.enemies.push(core)
        this.game.enemies.push(...Array.from({ length: SPIDER_COUNT }, (_, i) => new EnemySpider(this.game, core, i)))
        this.game.enemies.push(new EnemyDangler(this.game, -1), new EnemyDangler(this.game, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMother extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        super(game, SPIDER_LIFE * SPIDER_COUNT + DANGLER_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *rings() {
        yield* Array(FLIGHT_FRAMES + LAND_FRAMES + 20)

        for (let k = 0; k < 2; k++) {
            yield* remodel(this)
                .format("diamond")
                .p(this.p.clone())
                .duplicate(63)
                .scatter({ p: 120, hue: [0, 360] })
                .aim(this.game.player)
                .delayByIndex()
                .speed(12)
                .appear(30)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .fire(this.game.bullets)

            yield* Array(THROW_INTERVAL + 20)
        }
    }
}

class EnemySpider extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, SPIDER_LIFE, Size.S)

        this.setParent(parent, () => vec.arg(this.frame / 600 + (T * index) / SPIDER_COUNT).scale(160))

        this.scripts.add(() => this.cycle(index), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(index: number) {
        yield* GenUtils.all({
            web: this.throwWeb(index),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *throwWeb(index: number) {
        yield* Array(index * THROW_INTERVAL)
        if (this.life <= 0) return

        const near = this.game.player.p.add(vec.arg(this.random() * T).scale(this.random() * AIM_SPREAD))
        const target = SpiderWeb.landing(this.game, near, WEB)

        yield* SpiderWeb.cast(remodel(this), WEB, this.p.clone(), target, this.random() * T)
            .color("#f4f0ff")
            .fire(this.game.bullets)
    }
}

class EnemyDangler extends Enemy {
    constructor(game: Game, side: number) {
        super(game, DANGLER_LIFE, Size.S)

        this.scripts.add(() => this.enter(side))
    }

    private home(side: number) {
        return vec(this.game.WIDTH * (0.5 + side * 0.25), this.game.HEIGHT * 0.08)
    }

    private *enter(side: number) {
        this.p = this.home(side).add(vec(0, -this.game.HEIGHT * 0.2))
        yield* this.moveTo(this.home(side), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(side), { loop: Infinity })

        this.scripts.add(() => this.thread(), {
            loop: Infinity,
            margin: side > 0 ? (THREAD_FRAMES + THREAD_GAP_FRAMES) / 2 : 0,
        })
    }

    private *move(side: number) {
        const t = (this.frame - ENTRANCE_FRAMES) / 300 + (side > 0 ? Math.PI : 0)
        this.p = this.home(side).add(vec(Math.sin(t) * this.game.WIDTH * 0.12, 0))
        yield
    }

    private *thread() {
        for (let i = 0; i < THREAD_FRAMES; i += THREAD_INTERVAL) {
            yield* remodel(this)
                .format("small-ball")
                .color("#f4f0ff")
                .p(this.p.clone())
                .radian(T / 4)
                .speed(THREAD_SPEED)
                .fire(this.game.bullets)

            yield* Array(THREAD_INTERVAL)
        }

        yield* Array(THREAD_GAP_FRAMES)
    }
}
