import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"

// 月影道場主の「影絵」。
// 月(光源)のすぐそばで、小さな影絵の人形が形を作る。人形の影は、光源から遠い地面(画面の下の方)に何倍にも大きく映る。
// 映った影の輪郭は弾が並んだもので、触れれば被弾する(輪郭の内側は何もないので安全)。
// 人形が少し動くだけで、影は大きく素早く動く。人形を見れば、影がどう動くかを先に読める
export namespace Puppet {
    const SHADOW: Color = "#a08ce0"
    const PUPPET_COLOR = "rgba(255, 245, 210, 0.8)"
    // 影の輪郭の弾の間隔のめやす
    const SPACING = 15
    // 影が薄く浮かび上がってから実体になるまで
    const INTRO_FRAMES = 50
    // 人形は影のこの割合の大きさ(光源から影までの距離のこの割合の所にいる)
    const PUPPET_SCALE = 1 / 9

    // 影の形。光源から見た位置で、いくつかの折れ線で表す。t はフレーム数
    export type Shape = (t: number) => Vec[][]

    // 折れ線の長さ
    function length(line: readonly Vec[]) {
        let result = 0
        for (let i = 1; i < line.length; i++) result += line[i].sub(line[i - 1]).magnitude()
        return result
    }

    // 折れ線の、始めから長さの割合 u の所の点
    function at(line: readonly Vec[], u: number): Vec {
        let rest = u * length(line)

        for (let i = 1; i < line.length; i++) {
            const segment = line[i].sub(line[i - 1])
            const l = segment.magnitude()
            if (rest <= l || i === line.length - 1)
                return line[i - 1].add(segment.scale(l === 0 ? 0 : Math.min(1, rest / l)))
            rest -= l
        }

        return line[0]
    }

    // light(光源)のそばで shape の人形を動かし、その影を frames の間映す。影は薄く浮かび上がってから実体になり、最後は薄れて消える。
    // 影の輪郭の弾は、最初の形の長さに合わせて折れ線ごとに配り、毎フレーム折れ線の上へ均等に並べ直す
    export function* cast(e: Enemy, light: () => Vec, shape: Shape, frames: number) {
        const first = shape(0)
        const counts = first.map((line) => Math.max(2, Math.round(length(line) / SPACING) + 1))
        const owners = counts.flatMap((count, k) =>
            Array.from({ length: count }, (_, i) => [k, i / (count - 1)] as const),
        )
        let lines = first

        const place = (j: number) => {
            const [k, u] = owners[j]
            return light().add(at(lines[k], u))
        }

        yield* remodel(e)
            .format("big-ball")
            .r(9)
            .color(SHADOW)
            .speed(0)
            .type("neutral")
            .alpha(0)
            .unbounded()
            .duplicate(owners.length, (b, j) => {
                b.p = place(j)
                return b
            })
            .g(function* (me, j) {
                for (let f = 0; f < frames && e.life > 0; f++) {
                    me.p = place(j)

                    if (f < INTRO_FRAMES) {
                        me.alpha = 0.35 * (f / INTRO_FRAMES)
                    } else if (f === INTRO_FRAMES) {
                        me.alpha = 1
                        me.type = "enemy"
                    }

                    yield
                }

                yield* Behavior.fadeout(me, 20)
            })
            .fire(e.game.bullets)

        // 人形を動かし、小さな人形を光源のそばに描く
        for (let f = 0; f < frames && e.life > 0; f++) {
            lines = shape(f)
            const center = light()

            e.game.drawInWorld((ctx) => {
                ctx.strokeStyle = PUPPET_COLOR
                ctx.lineWidth = 2
                ctx.lineJoin = "round"

                for (const line of lines) {
                    ctx.beginPath()
                    line.forEach((p, i) => {
                        const q = center.add(p.scale(PUPPET_SCALE))
                        if (i === 0) ctx.moveTo(q.x, q.y)
                        else ctx.lineTo(q.x, q.y)
                    })
                    ctx.stroke()
                }
            })

            yield
        }
    }

    // ── 形 ──  どの形も、size 倍の大きさで origin(光源から見た位置)に映る

    // 横向きの狐。facing は向き(1で右、-1で左)。open(t) は口の開き(0で閉じている)
    export function fox(
        origin: Vec,
        size: number,
        facing: number,
        open: (t: number) => number,
        sway: (t: number) => Vec,
    ): Shape {
        const flip = (p: Vec) => vec(p.x * facing, p.y).scale(size)

        return (t) => {
            const o = origin.add(sway(t))
            const a = open(t)
            const hinge = vec(-60, 30)
            const head = [
                hinge,
                vec(-170, 90),
                vec(-250, 10),
                vec(-280, -150),
                vec(-190, -60),
                vec(-130, -190),
                vec(-90, -50),
                vec(40, -40),
                hinge.add(vec.arg(-0.1 - a).scale(320)),
            ]
            const jaw = [hinge.add(vec(10, 30)), hinge.add(vec(10, 30)).add(vec.arg(0.15 + a).scale(290))]

            return [head, jaw].map((line) => line.map((p) => o.add(flip(p))))
        }
    }

    // 羽ばたく鳥。flap(t) は翼の角度(正で上へ)
    export function bird(origin: Vec, size: number, flap: (t: number) => number, sway: (t: number) => Vec): Shape {
        return (t) => {
            const o = origin.add(sway(t))
            const a = flap(t)
            const shoulder = vec(0, -10)
            const body = [vec(0, -80), vec(0, 70), vec(-35, 130), vec(0, 100), vec(35, 130)]
            const wings = [-1, 1].map((side) => {
                const elbow = shoulder.add(vec(side * Math.cos(a) * 130, -Math.sin(a) * 130))
                const tip = elbow.add(vec(side * Math.cos(a * 1.7) * 140, -Math.sin(a * 1.7) * 140))
                return [shoulder, elbow, tip]
            })

            return [body, ...wings].map((line) => line.map((p) => o.add(p.scale(size))))
        }
    }

    // 跳ねる兎。光源に近づくほど影は大きくなるので、跳ねるたびに影はふくらむ。grow(t) は大きさの倍率、ears(t) は耳の傾き
    export function rabbit(
        origin: (t: number) => Vec,
        grow: (t: number) => number,
        ears: (t: number) => number,
    ): Shape {
        return (t) => {
            const s = grow(t)
            const o = origin(t)
            const tilt = ears(t)
            const body = Array.from({ length: 25 }, (_, i) =>
                vec(Math.cos((Math.PI * 2 * i) / 24) * 130, Math.sin((Math.PI * 2 * i) / 24) * 95),
            )
            const head = Array.from({ length: 17 }, (_, i) =>
                vec(95 + Math.cos((Math.PI * 2 * i) / 16) * 60, -95 + Math.sin((Math.PI * 2 * i) / 16) * 55),
            )
            const earLines = [-1, 1].map((side) => [
                vec(90 + side * 22, -145),
                vec(90 + side * 22, -145).add(vec.arg(-Math.PI / 2 + side * 0.25 + tilt).scale(160)),
            ])

            return [body, head, ...earLines].map((line) => line.map((p) => o.add(p).scale(s)))
        }
    }
}
