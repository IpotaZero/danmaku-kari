import { vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 砂塵道場主の「砂丘」。
// 降ってきた砂粒は画面の底に積もっていく。画面の幅を細い柱(列)に分け、砂粒は列ごとに積み上がる。
// 落ちた列が両隣より2粒以上高ければ、低い方へ転がり落ちる(安息角)。だから砂は自然に山の形になる。
// 積もった砂粒は実体のまま残るので、砂山が育つほど動ける場所は下から狭まっていく。
// 砂山は、風に吹かれて横へ流れたり(shift)、上下が逆さまになって空へ落ちていったり(rise)、静かに沈んで消えたり(clear)する
export namespace Dune {
    export const COLOR: Color = "#ffd890"
    const SHAKE_COLOR: Color = "#fff0c8"
    // 列の幅(=砂粒の大きさ)
    const CELL = 12
    const GRAIN_R = 6

    export class Field {
        private readonly heights: number[]
        // 列ごとに、積もった砂粒(下から順)
        private readonly piles: Bullet[][]

        constructor(private readonly game: Game) {
            const columns = Math.ceil(game.WIDTH / CELL)
            this.heights = Array(columns).fill(0)
            this.piles = Array.from({ length: columns }, () => [])
        }

        private column(x: number) {
            return Math.min(Math.max(Math.floor(x / CELL), 0), this.heights.length - 1)
        }

        private center(column: number) {
            return (column + 0.5) * CELL
        }

        // 列 column に次に積もる砂粒の中心の高さ
        private surface(column: number) {
            return this.game.HEIGHT - (this.heights[column] + 0.5) * CELL
        }

        // 列 column の高さ。画面の外は壁とみなして、砂がこぼれないようにする
        private height(column: number) {
            return column < 0 || column >= this.heights.length ? Infinity : this.heights[column]
        }

        // e から、点 (x, 0) より上で生まれて向き radian・速さ speed で落ちていく砂粒を作る
        grain(e: Enemy, x: number, radian: number, speed: number) {
            const field = this

            return remodel(e)
                .format("small-ball")
                .r(GRAIN_R)
                .color(COLOR)
                .p(vec(x, 1))
                .radian(radian)
                .speed(speed)
                .g(function* (me) {
                    yield* field.settle(me, () => this.random())
                })
        }

        // 砂粒 me を、積もるまで見守る。積もる高さまで来たら、低い隣へ転がるか、その列に積もる
        private *settle(me: Bullet, random: () => number) {
            while (me.life > 0) {
                const column = this.column(me.p.x)

                if (me.p.y >= this.surface(column)) {
                    const here = this.heights[column]
                    const lower = [column - 1, column + 1].filter((c) => this.height(c) <= here - 2)

                    if (lower.length > 0) {
                        // 低い方へ転がる。両方低ければ、より低い方(同じならどちらか)
                        const [a, b] = lower
                        const next =
                            b === undefined || this.heights[a] < this.heights[b]
                                ? a
                                : this.heights[a] > this.heights[b]
                                  ? b
                                  : random() < 0.5
                                    ? a
                                    : b
                        me.p.x = this.center(next)
                        me.radian = T / 4
                    } else {
                        me.p = vec(this.center(column), this.surface(column))
                        me.speed = 0
                        this.heights[column]++
                        this.piles[column].push(me)
                        return
                    }
                }

                yield
            }
        }

        // 一番高い砂山の高さ(粒の数)
        tallest() {
            return Math.max(...this.heights)
        }

        // 砂山をまるごと一列 direction(1で右、-1で左)へずらす。砂粒は小さく跳ねながら隣の列へ移る。
        // 風下の端からはみ出した砂粒は、薄れて消える
        shift(direction: number) {
            const columns = this.heights.length
            const order = Array.from({ length: columns }, (_, i) => (direction > 0 ? columns - 1 - i : i))

            for (const c of order) {
                const to = c + direction

                for (const g of this.piles[c]) {
                    if (to < 0 || to >= columns) {
                        g.addScript(() => Behavior.fadeout(g, 15))
                    } else {
                        const from = g.p.clone()
                        g.addScript(function* () {
                            for (let f = 1; f <= 8; f++) {
                                g.p = vec(from.x + direction * CELL * (f / 8), from.y - 5 * Math.sin((Math.PI * f) / 8))
                                yield
                            }
                        })
                    }
                }

                if (to >= 0 && to < columns) {
                    this.piles[to] = this.piles[c]
                    this.heights[to] = this.heights[c]
                }

                this.piles[c] = []
                this.heights[c] = 0
            }
        }

        // 積もった砂粒を、しばらく震わせてから、上へ向かって落としていく(上下が逆さまになったように)。
        // 砂山の形のまま縦の柱になって昇っていくので、砂の積もっていなかった列だけが抜け道になる
        rise(tremble: number, speed: number) {
            this.release(function* (g) {
                const x = g.p.x
                g.color = SHAKE_COLOR

                for (let f = 0; f < tremble; f++) {
                    g.p.x = x + (f % 4 < 2 ? 1 : -1)
                    yield
                }

                g.p.x = x
                g.color = COLOR
                g.radian = -T / 4
                yield* Behavior.accel(g, 50, speed)
            })
        }

        // 積もった砂粒を、静かに薄れさせて消す
        clear() {
            this.release((g) => Behavior.fadeout(g, 30))
        }

        // 積もった砂粒をすべて砂山から切り離し、それぞれに behavior をさせる。砂山は空になる
        private release(behavior: (g: Bullet) => Generator<void, void, void>) {
            this.piles.forEach((pile, c) => {
                for (const g of pile) g.addScript(() => behavior(g))
                this.piles[c] = []
                this.heights[c] = 0
            })
        }
    }
}
