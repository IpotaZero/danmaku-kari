import { Vec, vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 白虎の技
export namespace Tiger {
    export const COLOR: Color = "#f0f4ff"
    const STRIPE: Color = "#ffd060"

    // ── 爪 ────────────────────────────────────────────────────────────────
    // 画面を横切る平行な3本の爪痕が薄く引かれ、少しして実体になる。しばらくすると爪痕は細かく砕けて左右へ散る

    export type Claw = {
        // 爪痕の間隔と、爪痕の弾の間隔
        gap: number
        spacing: number
        // 薄く引かれてから実体になるまで(提示)と、実体でいる時間
        preview: number
        hold: number
    }

    // center を通る、向き angle の爪痕を3本引く
    export function claw(e: Enemy, center: Vec, angle: number, config: Claw) {
        const along = vec.arg(angle)
        const across = vec.arg(angle + T / 4)
        const reach = e.game.WIDTH + e.game.HEIGHT
        const points: [Vec, number][] = []

        for (const line of [-1, 0, 1]) {
            for (let d = -reach; d <= reach; d += config.spacing) {
                const p = center.add(along.scale(d)).add(across.scale(line * config.gap))
                if (0 <= p.x && p.x <= e.game.WIDTH && 0 <= p.y && p.y <= e.game.HEIGHT) points.push([p, d])
            }
        }

        return remodel(e)
            .format("small-ball")
            .r(5)
            .color(COLOR)
            .speed(0)
            .type("neutral")
            .alpha(0)
            .duplicate(points.length, (b, i) => {
                b.p = points[i][0]
                return b
            })
            .g(function* (me, i) {
                yield* Behavior.ease(me, "alpha", 0.25, 15)
                yield* Array(config.preview - 15)

                me.alpha = 1
                me.type = "enemy"
                yield* Array(config.hold)

                // 爪痕に沿って一つおきに、左右へ散る
                me.radian = angle + (Math.round(points[i][1] / config.spacing) % 2 === 0 ? T / 4 : -T / 4)
                yield* Behavior.accel(me, 40, 1.4)
                yield* Array(40)
                yield* Behavior.fadeout(me, 20)
            })
    }

    // ── 牙 ────────────────────────────────────────────────────────────────
    // 上あごと下あごの牙が target を挟むように薄く現れ、少しして実体になって噛み合わさる。
    // 噛み合うと上下の牙は互い違いに並んで抜けられなくなるので、閉じきる前に横へ逃げる

    export type Fang = {
        // あごの幅と、牙の間隔
        width: number
        spacing: number
        // 噛み合わせる前に開いている幅
        open: number
        // 薄く現れてから閉じ始めるまで(提示)と、閉じるのにかかる時間と、閉じたままでいる時間
        preview: number
        close: number
        hold: number
    }

    export function bite(e: Enemy, target: Vec, config: Fang) {
        const count = Math.floor(config.width / config.spacing)
        const teeth: [Vec, number][] = []

        for (const jaw of [-1, 1]) {
            for (let k = 0; k <= count; k++) {
                // 上下の牙は半分ずつずらして、互い違いに噛み合わせる
                const x = -config.width / 2 + (k + (jaw > 0 ? 0.5 : 0)) * config.spacing
                // あごはゆるく弧を描く(端ほど開いている)
                const bend = ((x / (config.width / 2)) ** 2 * config.open) / 3
                teeth.push([vec(x, jaw * bend), jaw])
            }
        }

        return remodel(e)
            .format("wedge")
            .color(COLOR)
            .speed(0)
            .type("neutral")
            .alpha(0)
            .duplicate(teeth.length, (b, i) => {
                const [offset, jaw] = teeth[i]
                b.p = target.add(offset).add(vec(0, jaw * config.open))
                b.radian = jaw > 0 ? -T / 4 : T / 4
                return b
            })
            .g(function* (me, i) {
                const [offset, jaw] = teeth[i]
                const from = target.add(offset).add(vec(0, jaw * config.open))
                const to = target.add(offset)

                me.removeScript("boundary")
                yield* Behavior.ease(me, "alpha", 0.25, 15)
                yield* Array(config.preview - 15)

                me.alpha = 1
                me.type = "enemy"

                for (let f = 1; f <= config.close; f++) {
                    me.p = from.add(to.sub(from).scale(Ease.In(f / config.close)))
                    yield
                }

                yield* Array(config.hold)
                yield* Behavior.fadeout(me, 20)
            })
    }

    // ── 咆哮 ──────────────────────────────────────────────────────────────
    // 隙間が一つだけ開いた輪が、次々に広がる。隙間は輪ごとに少しずつ回るので、隙間を追いかけて回り込む

    export type Roar = {
        // 輪の弾の数と、隙間の幅(弾何個ぶん)
        count: number
        gap: number
        speed: number
        // 輪の数・間隔と、輪ごとに隙間が回る角度
        rings: number
        interval: number
        turn: number
    }

    export function* roar(e: Enemy, start: number, config: Roar) {
        for (let k = 0; k < config.rings && e.life > 0; k++) {
            const gapAngle = start + config.turn * k

            yield* remodel(e)
                .format("small-ball")
                .r(5)
                .color(k % 2 === 0 ? COLOR : STRIPE)
                .p(e.p.clone())
                .speed(config.speed)
                .duplicate(config.count - config.gap, (b, j) => {
                    // 隙間の真ん中が gapAngle に来るよう、隙間の後ろから一周並べる
                    b.radian = gapAngle + (T * (j + config.gap / 2 + 0.5)) / config.count
                    return b
                })
                .fire(e.game.bullets)

            yield* Array(config.interval)
        }
    }
}
