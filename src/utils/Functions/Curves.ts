import { Vec, vec } from "@ipota/vec"

// ── プリミティブ ──────────────────────────────────────────────────────────────
export namespace Curves {
    export type Curve = (t: number) => Vec

    /** 直線補間 */
    export function line(start: Vec, end: Vec): Curve {
        return (t) => vec((1 - t) * start.x + t * end.x, (1 - t) * start.y + t * end.y)
    }

    /** 二次ベジェ曲線 */
    export function bezier(start: Vec, control: Vec, end: Vec): Curve {
        return (t) => {
            const u = 1 - t
            return vec(
                u * u * start.x + 2 * u * t * control.x + t * t * end.x,
                u * u * start.y + 2 * u * t * control.y + t * t * end.y,
            )
        }
    }

    /** Catmull-Rom スプライン（4点以上必要） */
    export function catmullRom(points: readonly Vec[]): Curve {
        if (points.length < 4) throw new Error("At least 4 points are required.")

        const segs = points.length - 3

        return (t) => {
            const scale = Math.min(t * segs, segs - 1e-10)
            const i = Math.floor(scale)
            const u = scale - i

            const [p0, p1, p2, p3] = points.slice(i, i + 4)
            const u2 = u * u
            const u3 = u2 * u

            return vec(
                0.5 *
                    (2 * p1.x +
                        (-p0.x + p2.x) * u +
                        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
                        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
                0.5 *
                    (2 * p1.y +
                        (-p0.y + p2.y) * u +
                        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
                        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
            )
        }
    }

    /** リサジュー曲線 */
    export function lissajous(width: number, height: number, fx: number, fy: number): Curve {
        return (t) => vec((width / 2) * Math.sin(fx * t), (height / 2) * Math.sin(fy * t))
    }

    /** エピトロコイド */
    export function epitrochoid(centerR: number, moveR: number, deltaR: number): Curve {
        return (t) =>
            vec(
                (centerR + moveR) * Math.cos(t) - deltaR * Math.cos(((centerR + moveR) / moveR) * t),
                (centerR + moveR) * Math.sin(t) - deltaR * Math.sin(((centerR + moveR) / moveR) * t),
            )
    }

    /** ハイポトロコイド */
    export function hypotrochoid(centerR: number, moveR: number, deltaR: number): Curve {
        return (t) =>
            vec(
                (centerR - moveR) * Math.cos(t) - deltaR * Math.cos(((centerR - moveR) / moveR) * t),
                (centerR - moveR) * Math.sin(t) - deltaR * Math.sin(((centerR - moveR) / moveR) * t),
            )
    }

    // ── コンビネータ ──────────────────────────────────────────────────────────────

    /** 複数のカーブを t=0〜1 の範囲で均等に連結する */
    export function join(...curves: Curve[]): Curve {
        const n = curves.length
        return (t) => {
            const scale = Math.min(t * n, n - 1e-10)
            const i = Math.floor(scale)
            return curves[i](scale - i)
        }
    }

    /**
     * 等速パラメータ化。
     * そのままの t は速度が一定にならないカーブを、弧長に比例した t で動くように変換する。
     * steps を大きくするほど精度が上がる（既定値 200 で大抵十分）。
     */
    export function normalize(curve: Curve, steps = 200): Curve {
        // 累積弧長テーブルを構築
        const table: number[] = [0]
        let prev = curve(0)

        for (let i = 1; i <= steps; i++) {
            const curr = curve(i / steps)
            table.push(table[i - 1] + Math.hypot(curr.x - prev.x, curr.y - prev.y))
            prev = curr
        }

        const totalLen = table[steps]

        return (s) => {
            const target = s * totalLen

            // 二分探索で対応する t を求める
            let lo = 0,
                hi = steps
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1
                table[mid] < target ? (lo = mid) : (hi = mid)
            }

            const frac = (target - table[lo]) / (table[hi] - table[lo] || 1)
            const t = (lo + frac) / steps

            return curve(t)
        }
    }
}
