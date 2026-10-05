import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 玄武の「波」。画面の上の外から、うねる波の線が何本も降りてくる。
// 線は弾が詰まっていて抜けられないが、一か所だけ切れ目がある。線はうねり続けるので、切れ目も上下に揺れる
export namespace Tide {
    export type Config = {
        // 波の線の数と、線と線の間隔
        lines: number
        lineGap: number
        // 降りる速さ
        speed: number
        // 線の弾の間隔と、切れ目の幅
        spacing: number
        gap: number
        // うねりの高さ・波長・周期
        height: number
        wavelength: number
        period: number
        color: Color
    }

    // 波が画面を抜けきるまでのフレーム数
    export function travelFrames(e: Enemy, config: Config) {
        return Math.ceil((e.game.HEIGHT + config.lines * config.lineGap + config.height * 2) / config.speed)
    }

    export function* surge(e: Enemy, config: Config) {
        const width = e.game.WIDTH
        const travel = travelFrames(e, config)

        for (let line = 0; line < config.lines; line++) {
            const top = -config.height - line * config.lineGap
            const gapX = width * (0.1 + 0.8 * e.random())
            const phase = e.random() * T
            const xs = Array.from(
                { length: Math.ceil(width / config.spacing) },
                (_, i) => (i + 0.5) * config.spacing,
            ).filter((x) => Math.abs(x - gapX) > config.gap / 2)

            yield* remodel(e)
                .format("small-ball")
                .r(6)
                .color(config.color)
                .speed(0)
                .duplicate(xs.length, (b, i) => {
                    b.p = vec(xs[i], top)
                    return b
                })
                .g(function* (me, i) {
                    // 波は画面の外から入ってきて外へ抜けていくので、端で消さない
                    me.removeScript("boundary")

                    for (let t = 0; t < travel; t++) {
                        const wave = Math.sin((T * xs[i]) / config.wavelength - (T * t) / config.period + phase)
                        me.p = vec(xs[i], top + config.speed * t + config.height * wave)
                        yield
                    }

                    me.life = 0
                })
                .fire(e.game.bullets)
        }
    }
}
