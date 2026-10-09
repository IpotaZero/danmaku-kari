import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 鉄壁道場の「盾」。盾の弾は自機の弾を受け止めて消す(レーザーは貫く)。もちろん自機が触れれば被弾する。
// 盾のすき間を通さないと、奥の敵に弾が届かない
export namespace Shield {
    export const COLOR: Color = "#c8d4e8"

    // 自機の弾が1フレームで進んだ線分が、盾に触れたかどうか。弾は速いので、すり抜けないよう線分で調べる
    function isTouching(me: Bullet, b: Bullet) {
        // 盾は数が多いので、明らかに遠い弾はベクトルを作らずに先に除く
        const reach = me.r + b.r + b.speed
        if (Math.abs(b.p.x - me.p.x) > reach || Math.abs(b.p.y - me.p.y) > reach) return false

        const end = b.p
        const start = b.p.sub(vec.arg(b.radian).scale(b.speed))
        const edge = end.sub(start)
        const lengthSquared = edge.magnitudeSquared()
        const t = lengthSquared === 0 ? 0 : Math.min(Math.max(me.p.sub(start).dot(edge) / lengthSquared, 0), 1)
        const closest = start.add(edge.scale(t))

        return closest.sub(me.p).magnitudeSquared() < (me.r + b.r) ** 2
    }

    // 盾が生きている間ずっと、触れた自機の弾を消す
    export function* block(me: Bullet) {
        while (me.life > 0) {
            for (const b of me.game.bullets) {
                if (b.type === "friend" && b.collision !== "rect" && b.life > 0 && isTouching(me, b)) {
                    b.life = 0
                }
            }

            yield
        }
    }

    // ── 盾の輪 ────────────────────────────────────────────────────────────
    // 敵のまわりを回る盾の輪。輪の向かい合う二か所に窓が開いている

    export type RingConfig = {
        radius: number
        // 輪に並べる弾の数と、窓一つぶんに抜く弾の数
        slots: number
        windowSlots: number
        // 1フレームあたりの回転
        spin: number
    }

    export class Ring {
        constructor(
            private readonly e: Enemy,
            private readonly config: RingConfig,
            private readonly phase: number,
        ) {}

        // 窓の真ん中の向き。もう一つの窓はこれを半周回した向き
        angle() {
            return this.phase + this.config.spin * this.e.frame
        }

        // 窓の外側の縁。k は窓の番号(0か1)
        window(k: number): Vec {
            return this.e.p.add(vec.arg(this.angle() + (k * T) / 2).scale(this.config.radius))
        }

        // 窓のところを抜いて輪を並べる。輪は敵について回り、敵が倒れると止まる
        build() {
            const { e, config } = this
            const ring = this
            const half = config.slots / 2
            const slots = Array.from({ length: config.slots }, (_, k) => k).filter(
                (k) => Math.abs((k % half) - (half / 2 - 0.5)) >= config.windowSlots / 2,
            )

            return remodel(e)
                .format("donut")
                .color(COLOR)
                .speed(0)
                .isScorable(false)
                .duplicate(slots.length)
                .g(function* (me, i) {
                    const angle = (T * (slots[i] + 0.5)) / config.slots - T / 4

                    yield* GenUtils.all({
                        block: block(me),
                        follow: (function* () {
                            while (e.life > 0 && me.life > 0) {
                                me.p = e.p.add(vec.arg(ring.angle() + angle).scale(config.radius))
                                yield
                            }
                        })(),
                    })
                })
                .appear(30)
        }
    }
}
