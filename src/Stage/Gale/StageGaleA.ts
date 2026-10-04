import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Wind } from "./Wind"

// ステージ「横風」(疾風道場・門下生)
// 画面の上端から、等間隔に並んだ何本もの雨の列が降ってくる。列の中は弾が詰まっていて抜けられないので、列と列の間に立つ。
// 雨が降っている途中で突風が吹き、すでに降っている雨は並びを保ったまま横へ流される。
// 突風の前には風の筋(当たり判定なし)が風下へ流れるので、どちらへ流されるかを読んで一緒に動けば抜けられる。
// 突風がやむと、流された雨の上に、まっすぐ降る雨がまた続いてくる。列の折れ目が通り過ぎるときにもう一度横へ動く。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。雨が画面下へ抜けた後、3秒ほど休憩が入る
const CYCLE_FRAMES = 620
// 雨を降らせ続ける時間
const RAIN_FRAMES = 180
// 雨の弾を落とす間隔と速さ。列の中の弾の間隔は両者の積(22.5px)で、自機の当たり判定の8倍より狭い
const RAIN_INTERVAL = 5
const RAIN_SPEED = 4.5
// 列と列の間隔
const COLUMN_GAP = 64
const WIND: Wind.Shape = { angle: T / 10, rise: 20, hold: 50, fall: 20 }
// 周期の始まりから、突風が吹くまで
const GUST_AT = [90, 230]

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1200).add(this.home())
        yield
    }

    private *cycle() {
        const forecast = new Wind.Forecast(
            GUST_AT.map((start) => ({ start, direction: this.random() < 0.5 ? -1 : 1 })),
            WIND,
        )

        yield* GenUtils.all({
            rain: this.rain(forecast),
            streaks: forecast.streaks(remodel(this), this.game, this.random).fire(this.game.bullets),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 上端に等間隔に並んだ列から雨を降らせる。どの弾も風の予報を見て、同じ時刻に同じ向きへ曲がる
    private *rain(forecast: Wind.Forecast) {
        const offset = this.random() * COLUMN_GAP
        const columns = Math.ceil((this.game.WIDTH - offset) / COLUMN_GAP)
        const drops = Math.floor(RAIN_FRAMES / RAIN_INTERVAL)

        yield* remodel(this)
            .format("diamond")
            .color("#9dffc8")
            .speed(RAIN_SPEED)
            .duplicate(columns * drops, (b, i) => {
                b.p = vec(offset + COLUMN_GAP * (i % columns), 1)
                b.delay = Math.floor(i / columns) * RAIN_INTERVAL
                b.radian = forecast.fall(b.delay)
                return b
            })
            .g(function* (me) {
                for (let t = me.delay; me.life > 0; t++) {
                    me.radian = forecast.fall(t)
                    yield
                }
            })
            .fire(this.game.bullets)
    }
}
