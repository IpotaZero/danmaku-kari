import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// チャンピオンの技
export namespace Sting {
    export const COLOR: Color = "#ffd040"

    // ── 毒針 ──────────────────────────────────────────────────────────────
    // 自機へ向けて薄い予告線が引かれ、少しして針の列が予告線に沿って一気に飛ぶ

    export type Needle = {
        // 予告線を引いてから針が飛ぶまで(提示)
        preview: number
        // 針の数と間隔(フレーム)、速さ
        count: number
        interval: number
        speed: number
    }

    // e から target へ向けて針を飛ばす
    export function* needle(e: Enemy, target: Vec, config: Needle) {
        const start = e.p.clone()
        const radian = target.sub(start).radian()

        yield* remodel(e)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color(COLOR)
            .r(2)
            .speed(0)
            .p(start)
            .radian(radian)
            .length(e.game.WIDTH + e.game.HEIGHT)
            .alpha(0)
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0.2, 12)
                yield* Array(config.preview - 12)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(e.game.bullets)

        yield* Array(config.preview)
        if (e.life <= 0) return

        yield* remodel(e)
            .format("line")
            .color(COLOR)
            .p(start)
            .radian(radian)
            .speed(config.speed)
            .duplicate(config.count, (b, i) => {
                b.delay = i * config.interval
                return b
            })
            .fire(e.game.bullets)
    }

    // ── 包囲網 ────────────────────────────────────────────────────────────
    // 自機のまわりに輪が薄く現れ、実体になって縮んでくる。輪には抜け道が二つだけ開いている。
    // 縮みきると輪は弾けて外へ散る

    export type Swarm = {
        // 輪の弾の数・抜け道一つぶんに抜く弾の数
        count: number
        gap: number
        // 輪の大きさ(はじめ・縮みきったとき)
        from: number
        to: number
        // 薄く現れてから縮み始めるまで(提示)と、縮むのにかかる時間
        preview: number
        shrink: number
    }

    export function swarm(e: Enemy, center: Vec, config: Swarm) {
        // 抜け道は二つ、だいたい向かい合わせに開ける
        const first = e.random() * T
        const gaps = [first, first + T / 2 + (e.random() - 0.5) * T * 0.4]
        const step = T / config.count
        // 二つの角のへだたり(0以上T/2以下)
        const apart = (a: number, b: number) => Math.abs(((((a - b) % T) + T * 1.5) % T) - T / 2)
        const angles = Array.from({ length: config.count }, (_, i) => i * step).filter((a) =>
            gaps.every((g) => apart(a, g) > (config.gap * step) / 2),
        )

        return remodel(e)
            .format("small-ball")
            .r(6)
            .color(COLOR)
            .speed(0)
            .type("neutral")
            .alpha(0)
            .duplicate(angles.length, (b, i) => {
                b.p = center.add(vec.arg(angles[i]).scale(config.from))
                return b
            })
            .g(function* (me, i) {
                me.removeScript("boundary")
                yield* Behavior.ease(me, "alpha", 0.25, 15)
                yield* Array(config.preview - 15)

                me.alpha = 1
                me.type = "enemy"

                for (let f = 1; f <= config.shrink; f++) {
                    const r = config.from + (config.to - config.from) * (f / config.shrink)
                    me.p = center.add(vec.arg(angles[i]).scale(r))
                    yield
                }

                me.radian = angles[i]
                yield* Behavior.accel(me, 30, 3)
            })
    }
}
