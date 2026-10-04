import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Meteor } from "./Meteor"

// ステージ「流れ星」(流星道場・門下生)
// 画面を斜めに横切る平行な予告線が、少しずつ時間をずらして何本も引かれ、引かれた線に沿って流れ星が駆け抜ける。
// 流れ星の後には尾が残り、しばらく斜めの縞になって画面に留まる。縞は抜けられないので、予告線と予告線の間に立っておく。
// 予告線は等間隔の線のうち一部にだけ引かれるので、縞と縞の間の広さはまちまちになる。
// 一度の流星群は二回。二回目は斜めの向きが変わるので、尾の縞が残っているうちに次の縞の間へ移る。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。尾が消えた後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 560
// 流星群の間隔
const SHOWER_INTERVAL = 150
// 等間隔の線の間隔(線に垂直に測った距離)と、そのうち流れ星が流れる線の割合
const LANE_GAP = 70
const FALL_RATE = 0.6
// 流れ星が流れる時刻のずれ
const STAGGER = 10
const METEOR: Meteor.Config = { preview: 60, speed: 10, tailInterval: 2, tailLife: 50, color: "#fff4b0" }

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.05, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            first: this.shower(0),
            second: this.shower(SHOWER_INTERVAL),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 斜めの向きを決め、平行な予告線を画面全体に並べて、その一部に流れ星を流す
    private *shower(wait: number) {
        yield* Array(wait)

        const angle = T / 4 + (this.random() < 0.5 ? -1 : 1) * (T / 14 + (this.random() * T) / 14)
        const center = vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
        const normal = vec.arg(angle + T / 4)
        const reach = (this.game.WIDTH + this.game.HEIGHT) / 2
        const offset = this.random() * LANE_GAP

        const lanes = Array.from({ length: Math.ceil((reach * 2) / LANE_GAP) }, (_, k) =>
            center.add(normal.scale(-reach + offset + k * LANE_GAP)),
        ).filter(() => this.random() < FALL_RATE)

        yield* GenUtils.all(
            Object.fromEntries(
                lanes.map((through, k) => [
                    `lane${k}`,
                    (function* (me: EnemyPupil) {
                        yield* Array(Math.floor(me.random() * lanes.length) * STAGGER)
                        yield* Meteor.fall(me, through, angle, METEOR)
                    })(this),
                ]),
            ),
        )
    }
}
