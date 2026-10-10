import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Curves } from "../../utils/Functions/Curves"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const REST_FRAMES = 240

export default class extends Stage {
    *G() {
        const parent = new EnemyBoss(this.game)
        this.game.enemies.push(parent)

        const satelliteCount = 3
        for (let i = 0; i < satelliteCount; i++) {
            this.game.enemies.push(new EnemySatellite(this.game, parent, i, satelliteCount))
        }

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.4, 3, 4)

    constructor(game: Game) {
        super(game, 1500, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.attack(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 900).add(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4))
        yield
    }

    private *attack() {
        yield* GenUtils.all({
            attack: this.radialVolley(),
            wait: Array(REST_FRAMES),
        })
    }

    private *radialVolley() {
        const stopFrames = 40
        const waitFrames = 20
        const accelFrames = 60
        const launchSpeed = 6

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("ball")
            .r(4)
            .speed(8)
            .color("#ffffff")
            .aim(this.game.player)
            .nway(13, T / 120)
            .delayByIndex()
            .g(function* (me, i) {
                yield* Behavior.reaccel(me, stopFrames, waitFrames - i, accelFrames, launchSpeed)
            })
            .fire(this.game.bullets)
    }
}

class EnemySatellite extends Enemy {
    constructor(
        game: Game,
        private readonly parent: Enemy,
        index: number,
        count: number,
    ) {
        super(game, 500, Size.S)

        const phase = (T * index) / count
        const orbitSpeed = T / 2400
        const radius = 250

        this.setParent(parent, () => vec.arg(phase + this.frame * orbitSpeed).scale(radius))

        this.scripts.add(() => this.attack(), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *attack() {
        yield* GenUtils.all({
            attack: this.fireAimed(5, T / 16, 10, 6),
            wait: Array(REST_FRAMES),
        })

        yield* GenUtils.all({
            attack: this.fireAimed(3, T / 14, 10, 6),
            wait: Array(REST_FRAMES),
        })
    }

    private *fireAimed(nway: number, angle: number, waitFrames: number, launchSpeed: number) {
        if (this.life <= 0) return

        const stopFrames = 40
        const accelFrames = 60

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("donut")
            .r(12)
            .speed(6)
            .color("#ff3366")
            .aim(this.game.player)
            .nway(nway, angle)
            .delayByIndex()
            .g(function* (me, i) {
                yield* Behavior.reaccel(me, stopFrames, waitFrames - i, accelFrames, launchSpeed)
            })
            .fire(this.game.bullets)
    }
}
