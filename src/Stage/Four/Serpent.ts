import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { Curves } from "../../utils/Functions/Curves"

// 龍や蛇。大きな弾を数珠つなぎにした胴が、頭の通った道筋をそのままたどって泳ぐ。胴は詰まっていて抜けられない。
// 泳ぎ出す前に、通り道に薄い点線(当たり判定なし)が引かれるので、どこを通るかは先に読める
export namespace Serpent {
    export type Config = {
        // 胴の節の数と、節と節の間隔(何フレーム遅れて頭を追うか)
        segments: number
        lag: number
        // 頭が1フレームに進む距離
        speed: number
        // 通り道の点線が引かれてから泳ぎ出すまで(提示)
        preview: number
        headR: number
        bodyR: number
        color: Color
    }

    // 通り道の点線の間隔
    const DOT_SPACING = 24

    // 道筋の長さ(px)
    function length(path: Curves.Curve) {
        let result = 0
        for (let i = 1; i <= 100; i++)
            result += path(i / 100)
                .sub(path((i - 1) / 100))
                .magnitude()
        return result
    }

    // 頭が通り道の始めから終わりまで進み、しっぽが終わりに着くまでのフレーム数(提示を除く)
    export function swimFrames(path: Curves.Curve, config: Config) {
        return Math.ceil(length(path) / config.speed) + config.segments * config.lag
    }

    // waypoints を滑らかにつないだ通り道を作る。始めと終わりの点も通る
    export function course(waypoints: readonly Vec[]): Curves.Curve {
        const first = waypoints[0]
        const last = waypoints[waypoints.length - 1]
        return Curves.normalize(Curves.catmullRom([first, ...waypoints, last]))
    }

    // 通り道 path に点線を引き、少ししてから龍を泳がせる。点線は龍が泳ぎ終えるまで残る
    export function* swim(e: Enemy, path: Curves.Curve, config: Config) {
        const total = length(path)
        const travel = Math.ceil(total / config.speed)
        const frames = travel + config.segments * config.lag
        const at = (f: number) => path(Math.min(Math.max(f / travel, 0), 1))
        const dots = Math.floor(total / DOT_SPACING)

        yield* remodel(e)
            .format("small-ball")
            .color(config.color)
            .type("neutral")
            .alpha(0)
            .speed(0)
            .isScorable(false)
            .duplicate(dots, (b, i) => {
                b.p = path(i / dots)
                return b
            })
            .g(function* (me) {
                me.removeScript("boundary")
                yield* Behavior.ease(me, "alpha", 0.2, 20)
                yield* Array(config.preview + frames - 20)
                yield* Behavior.fadeout(me, 20)
            })
            .fire(e.game.bullets)

        yield* Array(config.preview)

        // 節 i は頭より i * lag フレーム遅れて同じ道筋をたどる。始めの点から順に現れ、終わりの点で消える
        yield* remodel(e)
            .format("big-ball")
            .color(config.color)
            .speed(0)
            .duplicate(config.segments, (b, i) => {
                b.p = at(0)
                b.r = i === 0 ? config.headR : config.bodyR
                b.delay = i * config.lag
                return b
            })
            .g(function* (me) {
                me.removeScript("boundary")

                const r = me.r
                me.r = 0

                for (let f = 0; f < travel; f++) {
                    me.p = at(f)
                    me.r = r * Math.min(1, f / 10, (travel - f) / 10)
                    me.radian = at(f + 1)
                        .sub(me.p)
                        .radian()
                    yield
                }

                me.life = 0
            })
            .fire(e.game.bullets)
    }

    // 画面の外 start から入ってきて、waypoints を順に通り、画面の外 end へ抜ける通り道
    export function through(start: Vec, waypoints: readonly Vec[], end: Vec) {
        return course([start, ...waypoints, end])
    }

    // center のまわりを、半径 from から to まで turns 回巻いてとぐろを巻く通り道
    export function coil(start: Vec, center: Vec, from: number, to: number, turns: number, angle: number) {
        const points: Vec[] = [start]
        const steps = Math.ceil(turns * 12)

        for (let i = 0; i <= steps; i++) {
            const t = i / steps
            points.push(center.add(vec.arg(angle + t * turns * 2 * Math.PI).scale(from + (to - from) * t)))
        }

        return course(points)
    }
}
