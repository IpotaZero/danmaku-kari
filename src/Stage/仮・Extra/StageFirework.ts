import { Vec, vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 560

const ROCKETS = 4
const ROCKET_INTERVAL = 45

const PREVIEW_FRAMES = 45
const RISE_FRAMES = 50

const SPARKS = 30
const SPARK_SPEED = 2.6
const GRAVITY = 0.025
const SPARK_LIFE = 170
const COLORS: Color[] = ["#ff9090", "#90c8ff", "#ffe080", "#b0ff90", "#e0a0ff"]

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyMaster(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.04, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.1)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        const order = Array.from({ length: ROCKETS }, (_, k) => k).sort(() => this.random() - 0.5)

        yield* GenUtils.all({
            rockets: (function* (me: EnemyMaster) {
                for (const k of order) {
                    const x = (me.game.WIDTH * (k + 0.2 + 0.6 * me.random())) / ROCKETS
                    const burst = vec(x, me.game.HEIGHT * (0.25 + 0.2 * me.random()))

                    yield* me.launch(burst, COLORS[Math.floor(me.random() * COLORS.length)])
                    yield* Array(ROCKET_INTERVAL)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *launch(burst: Vec, color: Color) {
        const game = this.game
        const start = vec(burst.x, game.HEIGHT - 2)

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color(color)
            .r(2)
            .speed(0)
            .p(start)
            .radian(-T / 4)
            .length(start.y - burst.y)
            .alpha(0)
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0.2, 10)
                yield* Array(PREVIEW_FRAMES + RISE_FRAMES - 10)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(game.bullets)

        yield* Array(PREVIEW_FRAMES)
        if (this.life <= 0) return

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color(color)
            .p(start)
            .speed(0)
            .g(function* (me) {
                for (let f = 1; f <= RISE_FRAMES; f++) {
                    me.p = start.add(burst.sub(start).scale(Ease.Out(f / RISE_FRAMES)))
                    yield
                }

                yield* remodel(this)
                    .format("small-ball")
                    .color(color)
                    .p(burst.clone())
                    .speed(SPARK_SPEED)
                    .radian(this.random() * T)
                    .ex(SPARKS)
                    .g(function* (spark) {
                        let v = vec.arg(spark.radian).scale(spark.speed)

                        for (let f = 0; f < SPARK_LIFE; f++) {
                            v = v.scale(0.99).add(vec(0, GRAVITY))
                            spark.speed = v.magnitude()
                            spark.radian = v.radian()
                            yield
                        }

                        yield* Behavior.fadeout(spark, 30)
                    })
                    .fire(game.bullets)

                me.life = 0
            })
            .fire(game.bullets)
    }
}
