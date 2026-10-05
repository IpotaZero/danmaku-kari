import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Gravity } from "./Gravity"

// ステージ「重力レンズ」(流星道場・師範代)
// 師範代(暗い星)は重く、そばを通る弾を引き寄せて曲げる。近すぎる弾は呑み込んでしまう。
// 画面の上の左右にいる2つの光る星(衛星)が交互に、師範代の方へ向けて平行な弾の筋を何本も流す。
// 筋は師範代のそばで曲がり、師範代の向こう側(画面の下の方)で一点に集まってから交差して広がる。
// 集まる点の近くは弾が濃いので、そこを避ける。師範代はゆっくり左右に動くので、集まる点も一緒に動く。
// 師範代は自分では撃たない。光る星を落とせば、その星の筋は来なくなる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。左右の星が一度ずつ筋を流した後、3秒ほど休憩が入る
const CYCLE_FRAMES = 470
// 筋を流し続ける時間と、右の星が流し始めるまで
const STREAM_FRAMES = 120
const RIGHT_DELAY = 160
// 筋の本数・間隔、筋の弾を出す間隔と速さ。筋の中の弾の間隔は 5 × 4 = 20px
const STREAMS = 9
const STREAM_GAP = 40
const STREAM_INTERVAL = 5
const STREAM_SPEED = 4
// 暗い星の引力の強さと、弾を呑み込む距離
const LENS: Gravity.Config = { gm: 330, horizon: 26 }
const COLOR: Color = "#c8d8ff"

const QUASAR_LIFE = 750

export default class extends Stage {
    *G() {
        const lens = new EnemyLens(this.game)
        this.game.enemies.push(lens, new EnemyQuasar(this.game, lens, -1), new EnemyQuasar(this.game, lens, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyLens extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.06, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, QUASAR_LIFE * 2, 40, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.36)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1200).add(this.home())
        yield
    }
}

class EnemyQuasar extends Enemy {
    // side: -1で左、1で右
    constructor(
        game: Game,
        private readonly lens: Enemy,
        side: number,
    ) {
        super(game, QUASAR_LIFE, 24)

        this.addScript(() => this.enter(side))
    }

    private home(side: number) {
        return vec(this.game.WIDTH * (0.5 + side * 0.36), this.game.HEIGHT * 0.07)
    }

    private *enter(side: number) {
        yield* this.moveTo(this.home(side), ENTRANCE_FRAMES)

        this.addScript(() => this.move(side), { loop: Infinity })
        this.addScript(() => this.cycle(side), { loop: Infinity })
    }

    private *move(side: number) {
        const t = (this.frame - ENTRANCE_FRAMES) / 200
        this.p = this.home(side).add(vec(0, Math.sin(t) * this.game.HEIGHT * 0.02))
        yield
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            streams: this.streams(side > 0 ? RIGHT_DELAY : 0),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 暗い星の方へ向けて、平行な筋を何本も流す。筋の並びは暗い星をまたぐ
    private *streams(wait: number) {
        yield* Array(wait)

        const lens = this.lens
        const radian = lens.p.sub(this.p).radian()
        const across = vec.arg(radian + T / 4)
        const offsets: Vec[] = Array.from({ length: STREAMS }, (_, k) =>
            across.scale((k - (STREAMS - 1) / 2) * STREAM_GAP),
        )

        for (let f = 0; f < STREAM_FRAMES; f += STREAM_INTERVAL) {
            if (this.life <= 0) return

            yield* remodel(this)
                .format("small-ball")
                .color(COLOR)
                .radian(radian)
                .speed(STREAM_SPEED)
                .duplicate(STREAMS, (b, k) => {
                    b.p = this.p.add(offsets[k])
                    return b
                })
                .g((me) => Gravity.pull(me, lens, LENS))
                .appear(8)
                .fire(this.game.bullets)

            yield* Array(STREAM_INTERVAL)
        }
    }
}
