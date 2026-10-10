import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mochi } from "./Mochi"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 620

const TOSSES = 2
const TOSS_INTERVAL = 140
const MOCHI: Mochi.Config = {
    gravity: 0.16,
    restitution: 0.82,
    bounces: 3,
    waveCount: 11,
    waveSpeed: 2.2,
    color: "#fff6e8",
}

const RABBIT_LIFE = 700

export default class extends Stage {
    *G() {
        const mortar = new EnemyMortar(this.game)
        this.game.enemies.push(mortar, new EnemyRabbit(this.game, mortar, -1), new EnemyRabbit(this.game, mortar, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMortar extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        super(game, RABBIT_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity, margin: 100 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        for (let k = 0; k < 2; k++) {
            yield* remodel(this)
                .format("donut")
                .color("#e0d8ff")
                .p(this.p.clone())
                .speed(1.5)
                .radian(this.random() * T + (k * T) / 40)
                .ex(31)
                .g((me) => Behavior.appear(me, 20))
                .fire(this.game.bullets)

            yield* Array(30)
        }

        yield* Array(CYCLE_FRAMES / 2 - 60)
    }
}

class EnemyRabbit extends Enemy {
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, RABBIT_LIFE, Size.S)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.05 * Math.sin(this.frame / 80)))

        this.scripts.add(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            tosses: this.tosses(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *tosses(side: number) {
        yield* Array(side > 0 ? TOSS_INTERVAL / 2 : 0)

        for (let k = 0; k < TOSSES; k++) {
            if (this.life <= 0) return

            const x = this.game.WIDTH * (0.5 - side * (0.05 + 0.35 * this.random()))
            const landing = vec(x, this.game.HEIGHT - 22)
            const peak = this.game.HEIGHT * (0.05 + 0.1 * this.random())

            yield* Mochi.toss(this, landing, peak, MOCHI).fire(this.game.bullets)
            yield* Array(TOSS_INTERVAL)
        }
    }
}
