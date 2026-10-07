import { Vec, vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"

// 玄武の「水面」。
// 画面の下の方は水の中。弾は水に入ると速さが半分になり、向きは真下寄りに折れ曲がる(屈折)。
// 水から出るときは速さが倍に戻り、向きは水面寄りに折れ曲がる。水面すれすれに出ようとした弾は、水面で跳ね返って水の中に戻る(全反射)。
// 水の底に着いた弾は、一度だけ跳ね返って上へ向かう。
// 水が凍ると、水の中の弾はその場で止まる。氷が解けると、また動き出す
export namespace Water {
    // 水の中の速さの割合
    const SLOW = 0.5

    export type Waves = {
        // 波の高さ・波長・周期
        height: number
        length: number
        period: number
    }

    export class Surface {
        private t: number
        // 凍っているか
        frozen: boolean

        // level は水面の高さ(画面の上からのpx)。waves は波の立ち方
        constructor(
            public level: number,
            public waves: Waves,
        ) {
            this.t = 0
            this.frozen = false
        }

        // 横の位置 x での水面の高さ
        y(x: number): number {
            const { height, length, period } = this.waves
            if (height === 0) return this.level
            return this.level + height * Math.sin((Math.PI * 2 * x) / length - (Math.PI * 2 * this.t) / period)
        }

        // 横の位置 x での、水面の外向き(上向き)の法線
        normal(x: number): Vec {
            const { height, length, period } = this.waves
            const slope =
                height === 0
                    ? 0
                    : ((height * Math.PI * 2) / length) *
                      Math.cos((Math.PI * 2 * x) / length - (Math.PI * 2 * this.t) / period)
            return vec(slope, -1).normalize()
        }

        isUnder(p: Vec) {
            return p.y > this.y(p.x)
        }

        // e が生きている間、波を動かしながら水を描く
        *animate(e: Enemy) {
            while (e.life > 0) {
                this.t++
                const width = e.game.WIDTH
                const height = e.game.HEIGHT
                const points = Array.from({ length: 33 }, (_, i) => vec((width * i) / 32, this.y((width * i) / 32)))
                const frozen = this.frozen

                e.game.drawInWorld((ctx) => {
                    ctx.beginPath()
                    ctx.moveTo(0, height)
                    points.forEach((p) => ctx.lineTo(p.x, p.y))
                    ctx.lineTo(width, height)
                    ctx.closePath()
                    ctx.fillStyle = frozen ? "rgba(210, 235, 255, 0.22)" : "rgba(60, 120, 220, 0.14)"
                    ctx.fill()

                    ctx.beginPath()
                    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
                    ctx.strokeStyle = frozen ? "rgba(235, 248, 255, 0.8)" : "rgba(140, 200, 255, 0.55)"
                    ctx.lineWidth = frozen ? 3 : 2
                    ctx.stroke()
                })

                yield
            }
        }
    }

    // 向き d の光線が、法線 n の面で屈折した向き。屈折できない(全反射する)ときは undefined。
    // n は入ってくる側を向いた法線、eta は(入った先の速さ)/(入る前の速さ)
    function refract(d: Vec, n: Vec, eta: number): Vec | undefined {
        const cos = -n.dot(d)
        const k = 1 - eta * eta * (1 - cos * cos)
        if (k < 0) return undefined
        return d.scale(eta).add(n.scale(eta * cos - Math.sqrt(k)))
    }

    // 弾 me を、水面 surface で屈折・全反射させ、水の底で一度だけ跳ね返らせ、水が凍れば止める
    export function* swim(me: Bullet, surface: Surface) {
        let under = surface.isUnder(me.p)
        let bounced = false
        // 凍る前の速さ(凍っている間だけ覚えておく)
        let thawed = 0

        if (under) me.speed *= SLOW

        while (me.life > 0) {
            if (surface.frozen && under) {
                if (me.speed > 0) {
                    thawed = me.speed
                    me.speed = 0
                }
                yield
                continue
            }

            if (thawed > 0) {
                me.speed = thawed
                thawed = 0
            }

            const now = surface.isUnder(me.p)
            const d = vec.arg(me.radian)
            const n = surface.normal(me.p.x)

            if (!under && now) {
                // 水に入る
                const t = refract(d, n, SLOW)
                if (t) me.radian = t.radian()
                me.speed *= SLOW
                under = true
            } else if (under && !now) {
                // 水から出ようとする
                const t = refract(d, n.scale(-1), 1 / SLOW)

                if (t) {
                    me.radian = t.radian()
                    me.speed /= SLOW
                    under = false
                } else {
                    // 全反射。水面で跳ね返って水の中へ戻る
                    me.radian = d.sub(n.scale(2 * d.dot(n))).radian()
                    me.p = vec(me.p.x, surface.y(me.p.x) + 2)
                }
            }

            // 水の底で一度だけ跳ね返る
            if (under && !bounced && me.p.y > me.game.HEIGHT - me.r) {
                me.radian = -me.radian
                me.p = vec(me.p.x, me.game.HEIGHT - me.r)
                bounced = true
            }

            yield
        }
    }
}
