import { Vec, vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"
import { Mirage } from "./Mirage"

// 陽炎道場の「熱」。床に落ちた熱の種から、揺らめく泡の柱が昇る
export namespace Heat {
    export const COLOR: Color = "#ffb070"

    // 種が飛んでいる時間と、床で揺らめいている時間(この二つが柱の提示)
    const FLIGHT_FRAMES = 60
    const GLOW_FRAMES = 50
    export const SEED_FRAMES = FLIGHT_FRAMES + GLOW_FRAMES
    // 泡を噴き上げ続ける時間と、泡を出す間隔
    const BLOW_FRAMES = 160
    const BUBBLE_INTERVAL = 3
    export const PLUME_TOTAL_FRAMES = SEED_FRAMES + BLOW_FRAMES
    // 泡の昇る速さ(だんだん速くなる)
    const RISE_START = 1.5
    const RISE_END = 4
    // 柱のうねりの幅と速さ
    const SWAY = 26
    const SWAY_PERIOD = 18

    // e から floor へ熱の種を投げ、そこから泡の柱を昇らせる。sway はうねる向き。
    // mirrors を渡すと、種も泡もその鏡に映る(Mirage.reflect)
    export function* plume(e: Enemy, floor: Vec, sway: number, mirrors: readonly Mirage.Mirror[]) {
        // 種は当たり判定を持たない目印。だんだん濃くなりながら落ちていき、床で揺らめく
        yield* remodel(e)
            .format("big-ball")
            .color(COLOR)
            .type("neutral")
            .alpha(0)
            .isScorable(false)
            .p(e.p.clone())
            .g(function* (me) {
                yield* GenUtils.all({
                    fly: Behavior.throwTo(me, floor, FLIGHT_FRAMES),
                    fade: Behavior.ease(me, "alpha", 0.3, FLIGHT_FRAMES),
                })
                yield* Behavior.ease(me, "r", 32, GLOW_FRAMES, Ease.Sin)
                yield* Array(BLOW_FRAMES)
                yield* Behavior.fadeout(me, 20)
            })
            .mirrorAll(mirrors)
            .fire(e.game.bullets)

        yield* Array(SEED_FRAMES)
        if (e.life <= 0) return

        // 泡の横の位置は、生まれた時刻と昇った時間で決まる。同じ高さの泡は同じだけずれるので、柱がうねって見える
        yield* remodel(e)
            .format("small-ball")
            .color(COLOR)
            .radian(-T / 4)
            .speed(RISE_START)
            .duplicate(Math.floor(BLOW_FRAMES / BUBBLE_INTERVAL), (b, i) => {
                b.p = vec(floor.x, floor.y - 20)
                b.delay = i * BUBBLE_INTERVAL
                return b
            })
            .g(function* (me) {
                const born = me.delay

                for (let f = 0; ; f++) {
                    me.speed = Math.min(RISE_END, me.speed + 0.02)
                    me.p.x = floor.x + sway * SWAY * Math.sin((born + f * 0.6) / SWAY_PERIOD)
                    yield
                }
            })
            .mirrorAll(mirrors)
            .fire(e.game.bullets)
    }

    // 画面の幅を count 個に分け、それぞれの中のどこかへ種を投げて、count 本の柱を同時に昇らせる。隣り合う柱は逆向きにうねる
    export function* plumes(e: Enemy, count: number, mirrors: readonly Mirage.Mirror[]) {
        const width = e.game.WIDTH
        const floors = Array.from({ length: count }, (_, k) =>
            vec((width * (k + 0.2 + 0.6 * e.random())) / count, e.game.HEIGHT * 0.94),
        )

        yield* GenUtils.all(
            Object.fromEntries(floors.map((floor, k) => [`plume${k}`, plume(e, floor, k % 2 === 0 ? 1 : -1, mirrors)])),
        )
    }
}
