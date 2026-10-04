import { Vec, vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Bullet } from "../../Game/Actor/Bullet"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 朱雀の技。
// 翼: 敵の左右に弾を並べた翼が羽ばたく。打ち下ろすたびに、翼から羽根が抜けて揺れながら舞い落ちる。
// 不死鳥: 火の玉は燃え尽きると灰(薄く、当たり判定なし)になって止まり、しばらくして燃え上がってまた飛ぶ
export namespace Phoenix {
    export const FIRE: Color = "#ff7a4a"
    const ASH: Color = "#a09890"
    const FEATHER: Color = "#ffb070"

    // ── 翼 ────────────────────────────────────────────────────────────────

    export type Wing = {
        // 翼の羽根の数と、付け根からの間隔
        feathers: number
        spacing: number
        // 羽ばたく角度の幅と、一回の羽ばたきにかかるフレーム数
        amplitude: number
        period: number
    }

    // 翼の付け根からの距離
    const ROOT = 50

    // e の左右に翼を広げ、frames の間羽ばたかせる。打ち下ろしきるたびに、翼から羽根を舞い落とす
    export function* flap(e: Enemy, wing: Wing, frames: number) {
        const angle = (side: number, f: number) => {
            const lift = wing.amplitude * Math.sin((T * f) / wing.period)
            return side > 0 ? -lift : T / 2 + lift
        }
        const position = (side: number, i: number, f: number) =>
            e.p.add(vec.arg(angle(side, f)).scale(ROOT + i * wing.spacing))

        yield* remodel(e)
            .format("small-ball")
            .r(7)
            .color(FIRE)
            .speed(0)
            .duplicate(2 * wing.feathers)
            .g(function* (me, k) {
                const side = k < wing.feathers ? -1 : 1
                const i = k % wing.feathers

                me.removeScript("boundary")
                me.p = position(side, i, 0)
                yield* Behavior.appear(me, 20)

                for (let f = 20; f < frames && e.life > 0; f++) {
                    me.p = position(side, i, f)
                    yield
                }

                yield* Behavior.fadeout(me, 20)
            })
            .fire(e.game.bullets)

        // 打ち下ろしきる(一番下に来る)のは、周期の 3/4 のところ
        for (let f = 0; f < frames; f++) {
            if (f % wing.period === Math.floor((wing.period * 3) / 4) && e.life > 0) {
                yield* shed(
                    e,
                    [-1, 1].flatMap((side) => Array.from({ length: wing.feathers }, (_, i) => position(side, i, f))),
                )
            }

            yield
        }
    }

    // 羽根を舞い落とす。羽根は左右に揺れながら、だんだん速く落ちていく
    function shed(e: Enemy, points: readonly Vec[]) {
        return remodel(e)
            .format("wedge")
            .color(FEATHER)
            .speed(0.6)
            .duplicate(points.length, (b, i) => {
                b.p = points[i]
                return b
            })
            .scatter({ radian: [T / 4 - T / 10, T / 4 + T / 10] })
            .g(function* (me) {
                const base = me.radian
                const phase = this.random() * T

                for (let f = 0; ; f++) {
                    me.radian = base + 0.7 * Math.sin(phase + f / 14)
                    me.speed = Math.min(2.4, me.speed + 0.02)
                    yield
                }
            })
            .appear(10)
            .fire(e.game.bullets)
    }

    // ── 不死鳥 ────────────────────────────────────────────────────────────

    export type Rebirth = {
        // 灰になっている時間
        ash: number
        // 燃え上がってから飛び出す速さ
        speed: number
    }

    // 弾 me を灰にし、しばらくしてから燃え上がらせる。燃え上がった弾は direction() の向きへ飛ぶ
    export function* rebirth(me: Bullet, config: Rebirth, direction: () => number) {
        const color = me.color

        me.speed = 0
        me.type = "neutral"
        me.color = ASH
        yield* Behavior.ease(me, "alpha", 0.25, 10)
        yield* Array(config.ash)

        // 燃え上がる。濃くなりきった瞬間に当たり判定が生まれる
        me.color = color
        yield* Behavior.fadein(me, 20)

        me.radian = direction()
        yield* Behavior.accel(me, 40, config.speed)
    }

    // e から火の玉の輪を広げる。火の玉は止まると灰になり、燃え上がって自機へ向かってくる
    export function ring(e: Enemy, count: number, config: Rebirth) {
        const player = e.game.player

        return remodel(e)
            .format("donut")
            .color(FIRE)
            .p(e.p.clone())
            .speed(5)
            .radian(e.random() * T)
            .ex(count)
            .g(function* (me) {
                yield* Behavior.ease(me, "speed", 0, 80, Ease.Out)
                yield* rebirth(me, config, () => player.p.sub(me.p).radian())
            })
    }

    // 画面の上から火の粉を降らせる。火の粉はどこかで燃え尽きて灰になり、燃え上がってばらばらの向きへ飛ぶ
    export function embers(e: Enemy, count: number, frames: number, config: Rebirth) {
        const width = e.game.WIDTH

        return remodel(e)
            .format("small-ball")
            .r(6)
            .color(FIRE)
            .radian(T / 4)
            .speed(2.4)
            .duplicate(count, (b, i) => {
                b.p = vec(width * e.random(), 1)
                b.delay = Math.floor((frames * i) / count)
                return b
            })
            .g(function* (me) {
                yield* Array(Math.floor(70 + 150 * this.random()))
                const spread = this.random() * T
                yield* rebirth(me, config, () => spread)
            })
    }
}
