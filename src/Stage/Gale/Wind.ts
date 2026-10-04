import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Actor } from "../../Game/Actor/Actor"
import { Game } from "../../Game/Game"
import { Remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 疾風道場の「風」。
// 突風は前もって決めた時刻に吹く(風の予報)。弾は予報を見て自分の向きを決めるので、
// 同じ時刻に吹かれた弾はすべて同じだけ曲がり、弾幕の並びを保ったまま横へ流される。
// 突風の少し前から当たり判定のない筋(風の予告)が風下へ流れるので、どちらへ流されるかを先に読める。
export namespace Wind {
    export type Gust = {
        // 予報の始まりから数えて、突風が吹き始めるフレーム
        start: number
        // 1で右へ、-1で左へ吹く
        direction: number
    }

    export type Rain = {
        // 列と列の間隔
        gap: number
        // 雨を降らせ続ける時間
        frames: number
        // 雨の弾を落とす間隔と速さ。列の中の弾の間隔は両者の積になる
        interval: number
        speed: number
    }

    export type Shape = {
        // 風に吹かれて曲がる最大の角度
        angle: number
        // 強まるまで・吹き続ける・弱まるまでのフレーム数
        rise: number
        hold: number
        fall: number
    }

    // 筋が流れ始めてから突風が吹くまで
    const PREVIEW_FRAMES = 45
    const STREAK_SPEED = 16
    const STREAKS_PER_GUST = 24

    export class Forecast {
        constructor(
            readonly gusts: readonly Gust[],
            private readonly shape: Shape,
        ) {}

        // 予報の始まりから frame フレーム後の、風による向きのずれ。右へ吹いているときは正
        at(frame: number): number {
            return this.gusts.reduce((sum, gust) => sum + gust.direction * this.strength(frame - gust.start), 0)
        }

        // 下向き(T/4)に落ちる弾が、風を受けて向く方向。右へ吹かれると右下を向く
        fall(frame: number): number {
            return T / 4 - this.at(frame)
        }

        private strength(t: number): number {
            const { angle, rise, hold, fall } = this.shape

            if (t < 0) return 0
            if (t < rise) return angle * Ease.Out(t / rise)
            if (t < rise + hold) return angle
            if (t < rise + hold + fall) return angle * (1 - Ease.InOut((t - rise - hold) / fall))
            return 0
        }

        // 突風ごとに、風上の端から風下へ筋を流す。弾幕と同時に fire するので、delay は予報の始まりから数える
        streaks<Parent extends Actor>(r: Remodel<Parent>, game: Game, random: () => number) {
            const { rise, hold } = this.shape
            const gusts = this.gusts

            return r
                .format("line")
                .type("neutral")
                .alpha(0.25)
                .color("#d8ffe8")
                .speed(STREAK_SPEED)
                .isScorable(false)
                .duplicate(gusts.length * STREAKS_PER_GUST, (b, i) => {
                    const gust = gusts[Math.floor(i / STREAKS_PER_GUST)]
                    const k = i % STREAKS_PER_GUST

                    b.radian = gust.direction > 0 ? 0 : T / 2
                    b.p.x = gust.direction > 0 ? 1 : game.WIDTH - 1
                    b.p.y = game.HEIGHT * random()
                    b.delay = Math.max(
                        0,
                        Math.floor(gust.start - PREVIEW_FRAMES + ((PREVIEW_FRAMES + rise + hold) * k) / STREAKS_PER_GUST),
                    )
                    return b
                })
        }

        // 上端に等間隔に並んだ列から雨を降らせる。どの弾も予報を見て、同じ時刻に同じ向きへ曲がる。
        // offset は一番左の列の位置
        rain<Parent extends Actor>(r: Remodel<Parent>, game: Game, rain: Rain, offset: number) {
            const forecast = this
            const columns = Math.ceil((game.WIDTH - offset) / rain.gap)
            const drops = Math.floor(rain.frames / rain.interval)

            return r
                .speed(rain.speed)
                .duplicate(columns * drops, (b, i) => {
                    b.p = vec(offset + rain.gap * (i % columns), 1)
                    b.delay = Math.floor(i / columns) * rain.interval
                    b.radian = forecast.fall(b.delay)
                    return b
                })
                .g(function* (me) {
                    for (let t = me.delay; me.life > 0; t++) {
                        me.radian = forecast.fall(t)
                        yield
                    }
                })
        }
    }
}
