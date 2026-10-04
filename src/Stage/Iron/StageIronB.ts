import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Shield } from "./Shield"

// ステージ「城壁」(鉄壁道場・高弟)
// 高弟(ボス)の目の前に、窓が二つ開いた城壁が築かれ、ゆっくり降りてくる。
// 城壁は自機の弾を受け止めるので、窓を通さないと奥へ弾が届かない。城壁が自機のところまで降りてきたら、窓をくぐって抜ける。
// 城壁は薄い姿で築かれてから実体になって降り始めるので、窓の位置は先に読める。
// 左右の弓兵(衛星)が、城壁越しに矢を射かけてくる(敵の矢は城壁をすり抜ける)。

const ENTRANCE_FRAMES = 150
// 城壁を築く高さと、築いてから降り始めるまで(提示)
const BUILD_Y = 0.3
const BUILD_FRAMES = 60
const FALL_SPEED = 1.5
// 1周期に築く城壁の数と、築く間隔
const WALLS = 3
const WALL_INTERVAL = 170
// 1周期の長さ。最後の城壁が自機のところを過ぎた後、少し休憩が入る
const CYCLE_FRAMES = 900
// 城壁の弾の間隔と、窓の幅
const BRICK_SPACING = 14
const WINDOW = 64

const ARCHER_LIFE = 700

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyArcher(this.game, master, -1), new EnemyArcher(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, ARCHER_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            walls: (function* (me: EnemyMaster) {
                for (let k = 0; k < WALLS; k++) {
                    yield* me.wall()
                    yield* Array(WALL_INTERVAL)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 窓を二つ開けた城壁を築き、降ろす。窓は画面の左右の半分に一つずつ開ける
    private *wall() {
        const width = this.game.WIDTH
        const windows = [0, 1].map((k) => (width * (k + 0.15 + 0.7 * this.random())) / 2)
        const xs = Array.from({ length: Math.ceil(width / BRICK_SPACING) }, (_, i) => (i + 0.5) * BRICK_SPACING).filter(
            (x) => windows.every((w) => Math.abs(x - w) > WINDOW / 2),
        )

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color(Shield.COLOR)
            .speed(0)
            .radian(T / 4)
            .type("neutral")
            .alpha(0.3)
            .duplicate(xs.length, (b, i) => {
                b.p = vec(xs[i], this.game.HEIGHT * BUILD_Y)
                return b
            })
            .g(function* (me) {
                yield* Array(BUILD_FRAMES)

                me.type = "enemy"
                me.alpha = 1
                me.speed = FALL_SPEED

                yield* Shield.block(me)
            })
            .fire(this.game.bullets)
    }
}

class EnemyArcher extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, ARCHER_LIFE, 24)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.34, game.HEIGHT * 0.03 * Math.sin(this.frame / 100)))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 120 + (side > 0 ? 50 : 0), loop: Infinity })
    }

    // 3本の矢を、最初はゆっくり、だんだん速く射る
    private *cycle() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffe0a0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(3, T / 24)
            .g((me) => Behavior.accel(me, 50, 3.4))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
