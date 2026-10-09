import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { remodel } from "../../Game/Remodel"
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
}
