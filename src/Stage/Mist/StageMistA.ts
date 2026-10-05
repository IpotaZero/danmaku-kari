import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mist } from "./Mist"

// ステージ「朧」(霧隠道場・門下生)
// 左右の灯籠(衛星)が、それぞれ桃色と青色の輪を広げる。二色の輪は時計に合わせて交互に霧になる。
// 霧になった輪は薄く、当たり判定がない。今濃い色の輪だけを避け、薄い色の輪の上は素通りしてよい。
// ただし入れ替わりが近づくと薄い輪がだんだん濃くなってくるので、それまでに薄い輪の上から降りておく。
// 門下生(ボス)は霧にならない矢を自機へ投げ、立ち止まらせない。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。輪が画面を抜けた後、2秒ほど休憩が入る
const CYCLE_FRAMES = 560
// 輪を広げ続ける時間と、輪を出す間隔
const RING_FRAMES = 200
const RING_INTERVAL = 20
// 一つの輪の弾の数と、広がる速さ
const RING_COUNT = 30
const RING_SPEED = 2.2
// 二色が一度ずつ実体になるまでの長さと、入れ替わりにかかる時間
const CLOCK = new Mist.Clock(160, 36)
const COLORS: Color[] = ["#ffb0d0", "#a0c8ff"]

const LANTERN_LIFE = 700

export default class extends Stage {
    *G() {
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, new EnemyLantern(this.game, pupil, 0), new EnemyLantern(this.game, pupil, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, LANTERN_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            arrows: this.arrows(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 霧にならない矢。ゆっくり飛び出し、少しずつ速くなる
    private *arrows() {
        for (let k = 0; k < 3; k++) {
            yield* Array(80)

            yield* remodel(this)
                .format("arrow")
                .color("#ffffff")
                .p(this.p.clone())
                .speed(0.5)
                .aim(this.game.player.p)
                .nway(3, T / 16)
                .g((me) => Behavior.accel(me, 60, 4))
                .fire(this.game.bullets)
        }
    }
}

class EnemyLantern extends Enemy {
    // phase: 0なら左で桃色、1なら右で青色
    constructor(game: Game, parent: Enemy, phase: number) {
        super(game, LANTERN_LIFE, 24)

        const side = phase === 0 ? -1 : 1
        this.setParent(parent, () =>
            vec(side * game.WIDTH * 0.3, game.HEIGHT * 0.05 * Math.sin(this.frame / 120 + phase)),
        )

        this.addScript(() => this.cycle(phase), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(phase: number) {
        yield* GenUtils.all({
            rings: this.rings(phase),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 時計に合わせて霧になる輪を、一定の間隔で広げる。輪ごとに向きを半分ずらす
    private *rings(phase: number) {
        for (let k = 0; k < RING_FRAMES / RING_INTERVAL; k++) {
            if (this.life <= 0) return

            yield* remodel(this)
                .format("donut")
                .color(COLORS[phase])
                .p(this.p.clone())
                .speed(RING_SPEED)
                .radian(this.random() * T)
                .ex(RING_COUNT)
                .g(function* (me) {
                    yield* CLOCK.follow(me, phase, this.frame)
                })
                .fire(this.game.bullets)

            yield* Array(RING_INTERVAL)
        }
    }
}
