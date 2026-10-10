import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mist } from "./Mist"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 540

const THROW_INTERVAL = 20
const ROUND_INTERVAL = 110

const LAND_MIN = 90
const LAND_MAX = 170

const SHURIKEN: Mist.Shuriken = { flight: 90, stuck: 45, burstCount: 14, burstSpeed: 1.8, color: "#e0e0ff" }

const CLONE_COUNT = 4
const CLONE_LIFE = 450

const CLONE_OFFSETS = [vec(-0.36, 0.02), vec(0.36, 0.02), vec(-0.18, 0.14), vec(0.18, 0.14)]

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.clones)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)
    readonly clones = CLONE_OFFSETS.map((o, i) => new EnemyClone(this.game, this, o, i))

    constructor(game: Game) {
        super(game, CLONE_LIFE * CLONE_COUNT, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        this.chooseReal()

        yield* GenUtils.all({
            ring: this.ring(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private chooseReal() {
        const alive = this.clones.filter((c) => c.life > 0)
        if (alive.length === 0) return

        const real = alive[Math.floor(this.random() * alive.length)]
        alive.forEach((c) => {
            c.isInvincible = c !== real
        })
    }

    private *ring() {
        yield* Array(ROUND_INTERVAL + THROW_INTERVAL * CLONE_COUNT + SHURIKEN.flight + SHURIKEN.stuck)

        yield* remodel(this)
            .format("donut")
            .color("#e0e0ff")
            .p(this.p.clone())
            .speed(2)
            .radian(this.random() * T)
            .ex(23)
            .delayByIndex(10)
            .ex(13)
            .fire(this.game.bullets)
    }
}

class EnemyClone extends Enemy {
    constructor(game: Game, parent: Enemy, offset: Vec, index: number) {
        super(game, CLONE_LIFE, Size.S)

        this.setParent(parent, () =>
            vec(offset.x * game.WIDTH, (offset.y + 0.02 * Math.sin(this.frame / 90 + index)) * game.HEIGHT),
        )

        this.scripts.add(() => this.cycle(index), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(index: number) {
        yield* GenUtils.all({
            first: this.shuriken(THROW_INTERVAL * index),
            second: this.shuriken(ROUND_INTERVAL + THROW_INTERVAL * index),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *shuriken(wait: number) {
        yield* Array(wait)
        if (this.life <= 0) return

        const target = this.game.player.p.add(
            vec.arg(this.random() * T).scale(LAND_MIN + this.random() * (LAND_MAX - LAND_MIN)),
        )

        yield* Mist.shuriken(remodel(this), this.game, this.p.clone(), target, SHURIKEN).fire(this.game.bullets)
    }
}
