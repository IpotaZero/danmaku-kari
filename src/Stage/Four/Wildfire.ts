import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 朱雀の「燎原」。
// 画面の下の方に草むらが生える(薄い緑。当たり判定なし)。火種が灯ると、火は草から草へ燃え広がっていく。
// 燃えている草は実体の炎で、しばらく燃えると灰になって消える。火は草のない地面には燃え移らない。
// 燃え広がる前に、草の生え方と火種の場所が見えるので、火の来ない地面を探して立つ。
// 燃え上がった草はときどき火の粉を飛ばすので、地面の上でも気は抜けない
export namespace Wildfire {
    const GRASS: Color = "#88c878"
    const SPARK: Color = "#ffe070"
    const FLAMES: Color[] = ["#ff7040", "#ffa050"]
    const EMBER: Color = "#ffc080"
    // 草むらのます目の大きさと、炎の大きさ(隣り合う炎の間は自機が通れないくらい狭い)
    const CELL = 24
    const FLAME_R = 10

    export type Config = {
        // 草が生えそろうまで・火種が灯ってから燃え始めるまで(提示)
        grow: number
        kindle: number
        // 火が隣の草へ燃え移るまで・草が燃えている時間
        step: number
        burn: number
        // 燃え上がった草が火の粉を飛ばす確率と、火の粉の速さ
        ember: number
        emberSpeed: number
    }

    // 草むらの生え方。row, column のます目に草が生えているか
    export type Layout = (row: number, column: number) => boolean

    export class Field {
        readonly columns: number
        readonly rows: number
        private readonly top: number

        // 画面の高さの割合 top より下に、草むらのます目を敷く
        constructor(
            private readonly e: Enemy,
            top: number,
        ) {
            this.columns = Math.floor(e.game.WIDTH / CELL)
            this.top = e.game.HEIGHT * top
            this.rows = Math.floor((e.game.HEIGHT - this.top) / CELL)
        }

        position(row: number, column: number): Vec {
            const margin = (this.e.game.WIDTH - this.columns * CELL) / 2
            return vec(margin + (column + 0.5) * CELL, this.top + (row + 0.5) * CELL)
        }

        // p のあるます目
        cell(p: Vec): [number, number] {
            const margin = (this.e.game.WIDTH - this.columns * CELL) / 2
            return [
                Math.min(Math.max(Math.floor((p.y - this.top) / CELL), 0), this.rows - 1),
                Math.min(Math.max(Math.floor((p.x - margin) / CELL), 0), this.columns - 1),
            ]
        }

        // ── 生え方 ──

        // ところどころに丸くかたまった草むら。density くらいの割合で草が生える
        patches(density: number): Layout {
            // 粗い格子に乱数を置き、その間をなめらかにつないで、しきい値より大きい所を草にする
            const coarse = 5
            const values = Array.from({ length: Math.ceil(this.rows / coarse) + 2 }, () =>
                Array.from({ length: Math.ceil(this.columns / coarse) + 2 }, () => this.e.random()),
            )
            const smooth = (t: number) => t * t * (3 - 2 * t)

            return (row, column) => {
                const r = row / coarse
                const c = column / coarse
                const r0 = Math.floor(r)
                const c0 = Math.floor(c)
                const u = smooth(r - r0)
                const v = smooth(c - c0)
                const top = values[r0][c0] * (1 - v) + values[r0][c0 + 1] * v
                const bottom = values[r0 + 1][c0] * (1 - v) + values[r0 + 1][c0 + 1] * v
                return top * (1 - u) + bottom * u > 1 - density
            }
        }

        // 斜めの帯になった草むら。帯の幅と、帯と帯の間の地面の幅(ます目の数)
        stripes(angle: number, band: number, gap: number): Layout {
            const d = vec.arg(angle + T / 4)
            const offset = this.e.random() * (band + gap)

            return (row, column) => {
                const s = (column * d.x + row * d.y + offset) % (band + gap)
                return (s + band + gap) % (band + gap) < band
            }
        }

        // 迷路。道(草のない地面)は一ます幅で、それ以外はすべて草
        maze(): Layout {
            const rooms = (n: number) => Math.floor((n - 1) / 2)
            const height = rooms(this.rows)
            const width = rooms(this.columns)
            const open = Array.from({ length: this.rows }, () => Array(this.columns).fill(false))
            const visited = Array.from({ length: height }, () => Array(width).fill(false))
            const stack: [number, number][] = [
                [Math.floor(this.e.random() * height), Math.floor(this.e.random() * width)],
            ]

            visited[stack[0][0]][stack[0][1]] = true
            open[stack[0][0] * 2 + 1][stack[0][1] * 2 + 1] = true

            while (stack.length > 0) {
                const [r, c] = stack[stack.length - 1]
                const next = (
                    [
                        [r - 1, c],
                        [r + 1, c],
                        [r, c - 1],
                        [r, c + 1],
                    ] as [number, number][]
                ).filter(([nr, nc]) => nr >= 0 && nr < height && nc >= 0 && nc < width && !visited[nr][nc])

                if (next.length === 0) {
                    stack.pop()
                    continue
                }

                const [nr, nc] = next[Math.floor(this.e.random() * next.length)]
                visited[nr][nc] = true
                open[nr * 2 + 1][nc * 2 + 1] = true
                open[r + nr + 1][c + nc + 1] = true
                stack.push([nr, nc])
            }

            return (row, column) => !open[row][column]
        }

        // ── 燃え方 ──

        // layout の草むらを生やし、ignitions のます目に火種を灯して燃え広がらせる。
        // 火が燃え移るまでのフレーム数は、火種からます目伝いに数えた距離で決まる(届かない草は燃えずに枯れる)
        burn(layout: Layout, ignitions: readonly [number, number][], config: Config) {
            const distance = Array.from({ length: this.rows }, () => Array<number>(this.columns).fill(Infinity))
            const queue: [number, number][] = []

            for (const [r, c] of ignitions) {
                if (!layout(r, c) || distance[r][c] === 0) continue
                distance[r][c] = 0
                queue.push([r, c])
            }

            for (let i = 0; i < queue.length; i++) {
                const [r, c] = queue[i]
                for (const [nr, nc] of [
                    [r - 1, c],
                    [r + 1, c],
                    [r, c - 1],
                    [r, c + 1],
                ] as [number, number][]) {
                    if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.columns) continue
                    if (!layout(nr, nc) || distance[nr][nc] !== Infinity) continue
                    distance[nr][nc] = distance[r][c] + 1
                    queue.push([nr, nc])
                }
            }

            const cells: [number, number][] = []
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.columns; c++) {
                    if (layout(r, c)) cells.push([r, c])
                }
            }

            const reach = Math.max(0, ...cells.map(([r, c]) => distance[r][c]).filter((d) => d !== Infinity))
            const end = config.grow + config.kindle + reach * config.step + config.burn
            const e = this.e

            return remodel(e)
                .format("triangle")
                .r(FLAME_R)
                .color(GRASS)
                .speed(0)
                .type("neutral")
                .alpha(0)
                .radian(-T / 4)
                .duplicate(cells.length, (b, i) => {
                    b.p = this.position(...cells[i])
                    return b
                })
                .g(function* (me, i) {
                    const [r, c] = cells[i]
                    const d = distance[r][c]
                    const ignite = config.grow + config.kindle + d * config.step + Math.floor(this.random() * 3)

                    yield* Behavior.ease(me, "alpha", 0.28, config.grow)

                    // 火種は燃え始める前からちかちか光る
                    for (let f = config.grow; f < Math.min(ignite, end); f++) {
                        if (d === 0) {
                            me.color = f % 8 < 4 ? SPARK : GRASS
                            me.alpha = 0.5
                        }
                        yield
                    }

                    if (d === Infinity) {
                        // 火の届かない草は、燃え尽きるころに枯れて消える
                        yield* Behavior.fadeout(me, 30)
                        return
                    }

                    // 燃え上がる
                    me.type = "enemy"
                    me.alpha = 1

                    if (this.random() < config.ember) {
                        yield* remodel(this)
                            .format("small-ball")
                            .r(4)
                            .color(EMBER)
                            .p(me.p.clone())
                            .radian(this.random() * T)
                            .speed(config.emberSpeed)
                            .g(function* (spark) {
                                yield* Array(110)
                                yield* Behavior.fadeout(spark, 20)
                            })
                            .fire(e.game.bullets)
                    }

                    for (let f = 0; f < config.burn; f++) {
                        me.color = FLAMES[Math.floor((f + i) / 4) % 2]
                        yield
                    }

                    // 灰になって消える
                    me.color = "#807070"
                    yield* Behavior.fadeout(me, 20)
                })
        }

        // burn にかかるおおよそのフレーム数(火種から一番遠い草まで rows + columns ます進むとして)
        duration(config: Config) {
            return config.grow + config.kindle + (this.rows + this.columns) * config.step + config.burn + 20
        }
    }
}
