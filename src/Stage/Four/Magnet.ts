import { Vec, vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { Ctx } from "../../utils/Functions/Ctx"

// 白虎の「磁力」。
// 弾は N(赤)か S(青)の磁気を帯びている。自機も N か S のどちらかで、自機のまわりの輪の色で分かる。
// 自機と同じ色の弾は自機のそばで曲がってそれていき、違う色の弾は自機の方へ曲がって寄ってくる。弾の速さは変わらない。
// 自機の磁気はときどき入れ替わる。入れ替わる前には輪が明滅する
export namespace Magnet {
    export const N: Color = "#ff6a6a"
    export const S: Color = "#6aa8ff"
    // 自機の磁気が弾に届く距離と、一番近くでの曲げる強さ
    const RANGE = 230
    const STRENGTH = 0.13

    export const color = (polarity: number): Color => (polarity > 0 ? N : S)

    // 自機の磁気
    export class Field {
        // 1で N、-1で S
        polarity: number
        // 入れ替わりの予告中なら、入れ替わるまでの残りフレーム数
        private warning: number

        // (初期値はここで入れる。値つきのフィールドのすぐ後に *ジェネレータのメソッドを書くと、掛け算と読まれてしまうため)
        constructor() {
            this.polarity = 1
            this.warning = 0
        }

        // warn フレーム明滅して予告してから、自機の磁気を入れ替える
        *flip(warn: number) {
            for (this.warning = warn; this.warning > 0; this.warning--) yield
            this.polarity *= -1
        }

        // e が生きている間、自機のまわりに磁気の輪を描く
        *show(e: Enemy) {
            while (e.life > 0) {
                const p = e.game.player.p
                const blink = this.warning > 0 && Math.floor(this.warning / 6) % 2 === 0
                const shown = blink ? -this.polarity : this.polarity
                const c = color(shown)

                e.game.drawInWorld((ctx) => {
                    ctx.globalAlpha = 0.6
                    Ctx.arc(ctx, p, 22, c, { lineWidth: 3 })
                    ctx.globalAlpha = 0.18
                    Ctx.arc(ctx, p, 22, c)
                })

                yield
            }
        }

        // 磁気 polarity の弾 me を、自機の磁気で曲げ続ける
        *drift(me: Bullet, polarity: number) {
            me.color = color(polarity)

            while (me.life > 0) {
                const d = me.game.player.p.sub(me.p)
                const r = d.magnitude()

                if (r < RANGE && r > 1 && me.speed > 0) {
                    // 違う磁気なら引き寄せ、同じなら遠ざける
                    const pull = polarity === this.polarity ? -1 : 1
                    const force = d.scale((pull * STRENGTH * (1 - r / RANGE)) / r)
                    const v = vec.arg(me.radian).scale(me.speed).add(force)
                    me.radian = v.radian()
                }

                yield
            }
        }
    }

    // ── 磁力線 ──
    // N極と S極の間の磁場の向きへ進む弾。N極から出て、弧を描いて S極へ吸い込まれる

    // 点 p での磁場の向き(N極から湧き出し、S極へ吸い込まれる)
    function field(p: Vec, north: Vec, south: Vec): Vec {
        const from = (pole: Vec, sign: number) => {
            const d = p.sub(pole)
            const r = Math.max(d.magnitude(), 8)
            return d.scale(sign / r ** 3)
        }
        return from(north, 1).add(from(south, -1))
    }

    // 弾 me を、磁力線に沿って speed で進ませる。極は動いてもよい。S極に着くか、frames が尽きたら消える
    export function* line(me: Bullet, north: () => Vec, south: () => Vec, speed: number, frames: number) {
        me.speed = 0

        for (let f = 0; f < frames && me.life > 0; f++) {
            const b = field(me.p, north(), south())
            const length = b.magnitude()
            if (length === 0) break

            me.radian = b.radian()
            me.p = me.p.add(b.scale(speed / length))

            if (me.p.sub(south()).magnitude() < 16) break
            yield
        }

        me.type = "neutral"
        for (let f = 1; f <= 10; f++) {
            me.alpha = 1 - f / 10
            yield
        }
        me.life = 0
    }

    // 極の目印を描く
    export function* poles(e: Enemy, north: () => Vec, south: () => Vec, alive: () => boolean) {
        while (alive() && e.life > 0) {
            const n = north()
            const s = south()

            e.game.drawInWorld((ctx) => {
                ctx.globalAlpha = 0.8
                Ctx.arc(ctx, n, 14, N, { lineWidth: 3 })
                Ctx.arc(ctx, s, 14, S, { lineWidth: 3 })
                ctx.globalAlpha = 0.25
                Ctx.arc(ctx, n, 14, N)
                Ctx.arc(ctx, s, 14, S)
            })

            yield
        }
    }
}
