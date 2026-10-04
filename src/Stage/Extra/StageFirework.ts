import { Vec, vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"

// ステージ「花火」(修行場)
// 画面の下から花火が打ち上がる。打ち上がる前には、打ち上がる筋に薄い線(当たり判定なし)が引かれる。
// 花火は空高くで開き、火の粉は丸く広がってから、重さに引かれてしだれ柳のように垂れ下がってくる。
// 打ち上げの筋から離れ、垂れてくる火の粉の間を抜ける。花火は少しずつ時間をずらして、色を変えて上がる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。最後の火の粉が消えた後、2秒ほど休憩が入る
const CYCLE_FRAMES = 560
// 1周期に上げる花火の数と間隔
const ROCKETS = 4
const ROCKET_INTERVAL = 45
// 打ち上げの線を引いてから打ち上がるまで(提示)と、開くまでにかかる時間
const PREVIEW_FRAMES = 45
const RISE_FRAMES = 50
// 開いた火の粉の数・広がる速さ・重さ・消え始めるまでの時間
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
        super(game, 3000, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.1)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 画面の幅を ROCKETS 個に分けたそれぞれのどこかから、順番をばらばらにして打ち上げる
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

    // 画面の下から burst の高さまで打ち上げ、開かせる
    private *launch(burst: Vec, color: Color) {
        const game = this.game
        const start = vec(burst.x, game.HEIGHT - 2)

        // 打ち上げの筋の予告線
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

                // 開く。火の粉は丸く広がり、重さで垂れていく
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
