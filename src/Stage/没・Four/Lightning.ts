import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 青龍の「稲妻」。
// 稲妻の通り道が、ぎざぎざに枝分かれした薄い線として先に見える(当たり判定なし)。少しして、その線にそのまま雷が落ちる。
// 落ちた雷は弾が詰まった線で、しばらく光ってから消える
export namespace Lightning {
    const COLOR: Color = "#e8f4ff"
    const GLOW: Color = "#a8d8ff"
    // 稲妻の一歩の長さと、一歩ごとに曲がる角度の幅
    const STEP = 26
    const JAG = 0.9
    // 枝分かれする確率と、枝の長さ(歩数)
    const BRANCH_RATE = 0.16
    const BRANCH_STEPS = [5, 10]
    // 線の弾の間隔
    const SPACING = 11

    export type Config = {
        // 予告の線が見えてから雷が落ちるまで(提示)と、落ちた雷が光っている時間
        preview: number
        strike: number
    }

    // start から direction の向きへ、steps 歩ぶんの稲妻の形(折れ線のあつまり)を作る
    function shape(start: Vec, direction: number, steps: number, random: () => number): Vec[][] {
        const lines: Vec[][] = []

        const walk = (from: Vec, heading: number, count: number, branching: boolean) => {
            const line = [from]
            let p = from

            for (let i = 0; i < count; i++) {
                const turn = (random() - 0.5) * JAG
                p = p.add(vec.arg(heading + turn).scale(STEP))
                line.push(p)

                if (branching && random() < BRANCH_RATE) {
                    const side = random() < 0.5 ? -1 : 1
                    const length = BRANCH_STEPS[0] + Math.floor(random() * (BRANCH_STEPS[1] - BRANCH_STEPS[0]))
                    walk(p, heading + side * (0.5 + random() * 0.4), length, false)
                }
            }

            lines.push(line)
        }

        walk(start, direction, steps, true)
        return lines
    }

    // 折れ線の上に、SPACING おきに点を置く
    function sample(line: readonly Vec[]): Vec[] {
        const result: Vec[] = []

        for (let i = 1; i < line.length; i++) {
            const edge = line[i].sub(line[i - 1])
            const count = Math.max(1, Math.round(edge.magnitude() / SPACING))
            for (let j = 0; j < count; j++) result.push(line[i - 1].add(edge.scale(j / count)))
        }

        result.push(line[line.length - 1])
        return result
    }

    // e が、start から direction の向きへ、steps 歩ぶんの稲妻を落とす
    export function bolt(e: Enemy, start: Vec, direction: number, steps: number, config: Config) {
        const points = shape(start, direction, steps, () => e.random()).flatMap(sample)

        return remodel(e)
            .format("small-ball")
            .r(6)
            .color(GLOW)
            .speed(0)
            .type("neutral")
            .alpha(0)
            .unbounded()
            .duplicate(points.length, (b, i) => {
                b.p = points[i]
                return b
            })
            .g(function* (me) {
                // 予告。薄い線がちらつきながら濃くなっていく
                for (let f = 0; f < config.preview; f++) {
                    me.alpha = 0.12 + 0.18 * (f / config.preview) + (f % 6 < 3 ? 0.05 : 0)
                    yield
                }

                // 落雷
                me.type = "enemy"
                me.alpha = 1
                me.color = COLOR
                yield* Array(config.strike)

                yield* Behavior.fadeout(me, 15)
            })
    }

    // 地面へ向かう、自機のあたりを狙った稲妻の向き(真下から少しだけ自機の方へ傾ける)
    export function toward(from: Vec, target: Vec, spread: number, random: () => number) {
        const aim = target.sub(from).radian()
        const down = T / 4
        // 真下と自機の方向の間を取り、さらにばらつかせる
        return down + (aim - down) * 0.5 + (random() - 0.5) * spread
    }
}
