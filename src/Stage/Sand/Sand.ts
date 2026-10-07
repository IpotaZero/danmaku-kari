import { Vec, vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 砂塵道場の技。どれも撃つ敵(e)の乱数と位置を使う
export namespace Sand {
    export const COLOR: Color = "#ffd890"

    // ── 砂嵐 ──────────────────────────────────────────────────────────────
    // 横に吹き流れる砂の筋が何段も重なった帯を、画面の上の外から下の外まで降ろす。
    // 筋は砂粒が途切れ途切れに並んだもので、段ごとに流れる向きと速さが違う。
    // 筋は横に一周する輪のように流れ、画面の端から出た砂粒は反対の端から戻ってくる

    export type Band = {
        // 段数と段の間隔
        rows: number
        rowGap: number
        // 帯が降りる速さ
        speed: number
        // 筋の砂粒の間隔
        spacing: number
        // 筋が続く長さ・切れ目の長さ・流れる速さの範囲
        segment: [number, number]
        gap: [number, number]
        flow: [number, number]
    }

    // 帯が画面を抜けきるまでのフレーム数
    export function travelFrames(e: Enemy, band: Band) {
        return Math.ceil((e.game.HEIGHT + band.rows * band.rowGap + band.rowGap) / band.speed)
    }

    export function* storm(e: Enemy, band: Band) {
        const width = e.game.WIDTH
        const top = -band.rows * band.rowGap
        const travel = travelFrames(e, band)
        const between = ([min, max]: [number, number]) => min + e.random() * (max - min)

        for (let row = 0; row < band.rows; row++) {
            const grains: number[] = []
            let s = 0

            // 画面幅より少し長い輪の上に、筋と切れ目を交互に並べる
            while (s < width + 80) {
                const segment = between(band.segment)
                for (let d = 0; d < segment; d += band.spacing) grains.push(s + d)
                s += segment + between(band.gap)
            }

            const loop = s
            const flow = between(band.flow) * (row % 2 === 0 ? 1 : -1)
            const y = top + row * band.rowGap

            yield* remodel(e)
                .format("small-ball")
                .isScorable(false)
                .color(COLOR)
                .speed(0)
                .duplicate(grains.length, (b, i) => {
                    b.p = vec(grains[i] - (loop - width) / 2, y)
                    return b
                })
                .unbounded()
                .g(function* (me, i) {
                    for (let t = 0; t < travel; t++) {
                        const along = (((grains[i] + flow * t) % loop) + loop) % loop
                        me.p = vec(along - (loop - width) / 2, y + band.speed * t)
                        yield
                    }

                    me.life = 0
                })
                .fire(e.game.bullets)
        }
    }

    // ── 蟻地獄 ────────────────────────────────────────────────────────────

    // frames の間、自機を e へ向けて引きずる。strength は1フレームあたりに引きずる距離
    export function* suction(e: Enemy, strength: number, frames: number) {
        for (let i = 0; i < frames; i++) {
            const player = e.game.player
            const diff = e.p.sub(player.p)
            const distance = diff.magnitude()

            if (distance > 1 && !e.game.textBox.isShowing) {
                player.drag(diff.scale(Math.min(strength, distance) / distance))
            }

            yield
        }
    }

    // 吸い込みの提示。frames の間、砂粒(当たり判定なし)が渦を巻いて e へ流れ込み続ける
    export function swirl(e: Enemy, frames: number) {
        const count = Math.floor(frames / 4)
        const flight = 90

        return remodel(e)
            .format("small-ball")
            .type("effect")
            .alpha(0.3)
            .color(COLOR)
            .speed(0)
            .isScorable(false)
            .duplicate(count, (b, i) => {
                b.delay = Math.floor((Math.max(0, frames - flight) * i) / count)
                return b
            })
            .unbounded()
            .g(function* (me) {
                const angle = this.random() * T
                const radius = 260 + this.random() * 200

                for (let f = 0; f < flight; f++) {
                    const t = f / flight
                    me.p = e.p.add(vec.arg(angle + t * T * 0.6).scale(radius * (1 - t)))
                    yield
                }

                me.life = 0
            })
    }

    // e から自機へ向けて、扇形に速さのばらばらな砂をかける
    export function throwSand(e: Enemy, count: number) {
        const aim = e.game.player.p.sub(e.p).radian()

        return remodel(e)
            .format("small-ball")
            .color(COLOR)
            .p(e.p.clone())
            .duplicate(count)
            .scatter({ radian: [aim - T / 5, aim + T / 5], speed: [2, 4.5] })
    }

    // ── 砂時計 ────────────────────────────────────────────────────────────
    // 弾を並べた大きな砂時計。描かれてから、立って砂を落とす→半回転してひっくり返る、を2回くり返して消える

    export class Hourglass {
        // 砂時計が薄い姿で描かれている時間(提示)
        static readonly DRAW_FRAMES = 60
        // 砂を落とし続ける時間と、ひっくり返るのにかかる時間
        static readonly HOLD_FRAMES = 160
        static readonly FLIP_FRAMES = 360
        static readonly FADE_FRAMES = 30
        static readonly TOTAL_FRAMES = Hourglass.DRAW_FRAMES + (Hourglass.HOLD_FRAMES + Hourglass.FLIP_FRAMES) * 2

        // 大きさ(画面に対する割合)と、くびれの隙間の半分の幅
        private static readonly HALF_WIDTH = 0.44
        private static readonly HALF_HEIGHT = 0.42
        private static readonly NECK = 22
        // 線を構成する弾の間隔。自機の当たり判定の8倍より狭いので、線は抜けられない
        private static readonly SPACING = 16
        // 砂を落とす間隔と速さ。砂の筋の弾の間隔は両者の積(12px)
        private static readonly POUR_INTERVAL = 4
        private static readonly POUR_SPEED = 3

        // directions は1回目・2回目にひっくり返る向き
        constructor(private readonly directions: readonly number[]) {}

        // 中心から見た、砂時計の線の上の弾の位置。くびれは上下のふくらみの間に NECK*2 の隙間を空ける
        private static shape(halfWidth: number, halfHeight: number): Vec[] {
            const neck = Hourglass.NECK
            const segments: [Vec, Vec][] = []

            for (const y of [-halfHeight, halfHeight]) {
                const left = vec(-halfWidth, y)
                const right = vec(halfWidth, y)
                segments.push([left, right], [left, vec(-neck, 0)], [right, vec(neck, 0)])
            }

            return segments.flatMap(([from, to]) => {
                const edge = to.sub(from)
                const count = Math.ceil(edge.magnitude() / Hourglass.SPACING)
                return Array.from({ length: count + 1 }, (_, i) => from.add(edge.scale(i / count)))
            })
        }

        // 描き始めから t フレーム後の傾き
        private angle(t: number): number {
            let result = 0
            let start = Hourglass.DRAW_FRAMES + Hourglass.HOLD_FRAMES

            for (const direction of this.directions) {
                const progress = Math.min(Math.max((t - start) / Hourglass.FLIP_FRAMES, 0), 1)
                result += direction * (T / 2) * Ease.InOut(progress)
                start += Hourglass.FLIP_FRAMES + Hourglass.HOLD_FRAMES
            }

            return result
        }

        // 描き始めから t フレーム後に、砂を落としているかどうか
        private isPouring(t: number): boolean {
            const u = t - Hourglass.DRAW_FRAMES
            const round = Hourglass.HOLD_FRAMES + Hourglass.FLIP_FRAMES
            return 0 <= u && u < round * 2 && u % round < Hourglass.HOLD_FRAMES
        }

        // center をくびれにして砂時計を描き、くびれを中心に回す。すべての弾が同じ傾きを見るので、形を保ったまま回る
        draw(e: Enemy, center: Vec) {
            const hourglass = this
            const offsets = Hourglass.shape(e.game.WIDTH * Hourglass.HALF_WIDTH, e.game.HEIGHT * Hourglass.HALF_HEIGHT)

            return remodel(e)
                .format("small-ball")
                .color(COLOR)
                .speed(0)
                .type("neutral")
                .alpha(0.3)
                .duplicate(offsets.length, (b, i) => {
                    b.p = center.add(offsets[i])
                    return b
                })
                .unbounded()
                .g(function* (me, i) {
                    // 大きさ0から現れる(見た目と判定は常に一致)。薄い間は当たり判定がない
                    yield* Behavior.appear(me, Hourglass.DRAW_FRAMES / 2)
                    yield* Array(Hourglass.DRAW_FRAMES / 2)
                    me.type = "enemy"
                    me.alpha = 1

                    for (let t = Hourglass.DRAW_FRAMES; t < Hourglass.TOTAL_FRAMES; t++) {
                        me.p = center.add(offsets[i].rotate(hourglass.angle(t)))
                        yield
                    }

                    yield* Behavior.fadeout(me, Hourglass.FADE_FRAMES)
                })
        }

        // 砂時計が立っている間、e の位置から砂を真下へ落とす。砂は下のふくらみの底で消える
        *pour(e: Enemy) {
            const floor = e.game.HEIGHT * (0.5 + Hourglass.HALF_HEIGHT)

            for (let t = 0; t < Hourglass.TOTAL_FRAMES; t += Hourglass.POUR_INTERVAL) {
                if (this.isPouring(t)) {
                    yield* remodel(e)
                        .format("small-ball")
                        .color(COLOR)
                        .p(e.p.add(vec((e.random() - 0.5) * 8, 0)))
                        .radian(T / 4)
                        .speed(Hourglass.POUR_SPEED)
                        .g(function* (me) {
                            while (me.p.y < floor) yield
                            me.life = 0
                        })
                        .fire(e.game.bullets)
                }

                yield* Array(Hourglass.POUR_INTERVAL)
            }
        }
    }
}
