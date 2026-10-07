import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 鉄壁道場の「盾」。盾の弾は自機の弾を受け止めて消す(レーザーは貫く)。もちろん自機が触れれば被弾する。
// 盾のすき間を通さないと、奥の敵に弾が届かない
export namespace Shield {
    export const COLOR: Color = "#c8d4e8"
    // 壊れる盾の色。削れるほど赤くなる
    const BREAKABLE_COLORS: Color[] = ["#ff8a8a", "#ffb08a", "#ffd88a", "#e8f0ff"]

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

    // 受け止めるたびに削れる盾。durability 発ぶんの威力を受けると砕ける。削れるほど色が変わる
    export function* breakable(me: Bullet, durability: number) {
        let rest = durability

        while (rest > 0 && me.life > 0) {
            for (const b of me.game.bullets) {
                if (b.type === "friend" && b.collision !== "rect" && b.life > 0 && isTouching(me, b)) {
                    b.life = 0
                    rest -= b.damage
                }
            }

            me.color = BREAKABLE_COLORS[Math.min(BREAKABLE_COLORS.length - 1, Math.floor((rest / durability) * 4))]
            yield
        }

        yield* Behavior.fadeout(me, 10)
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

    // ── 城壁 ──────────────────────────────────────────────────────────────

    export type WallConfig = {
        // 城壁の弾の間隔と、窓の幅
        spacing: number
        window: number
        // 薄い姿で築かれてから実体になって降り始めるまで(提示)と、降りる速さ
        build: number
        speed: number
    }

    // 高さ y に、windows(窓の真ん中のx座標)のところを開けた城壁を築き、降ろす
    export function wall(e: Enemy, y: number, windows: readonly number[], config: WallConfig) {
        const xs = Array.from(
            { length: Math.ceil(e.game.WIDTH / config.spacing) },
            (_, i) => (i + 0.5) * config.spacing,
        ).filter((x) => windows.every((w) => Math.abs(x - w) > config.window / 2))

        return remodel(e)
            .format("small-ball")
            .r(6)
            .color(COLOR)
            .speed(0)
            .radian(T / 4)
            .type("neutral")
            .alpha(0.3)
            .duplicate(xs.length, (b, i) => {
                b.p = vec(xs[i], y)
                return b
            })
            .g(function* (me) {
                yield* Array(config.build)

                me.type = "enemy"
                me.alpha = 1
                me.speed = config.speed

                yield* block(me)
            })
    }

    // ── 甲羅 ──────────────────────────────────────────────────────────────

    export type ShellConfig = {
        // 弾の間隔と、内側・外側の半径
        spacing: number
        inner: number
        outer: number
        // 一枚が砕けるまでに受け止める威力
        durability: number
        // 1フレームあたりの回転
        spin: number
        // まとうのにかかる時間・甲羅でいる時間・弾け飛ぶ前に明滅する時間
        form: number
        hold: number
        warn: number
        // 破片が飛ぶ速さ
        shardSpeed: number
    }

    // 中心から見た、甲羅の弾の位置。蜂の巣(六角格子)の点のうち、内側と外側の半径の間にあるもの
    function honeycomb(config: ShellConfig): Vec[] {
        const a = vec(config.spacing, 0)
        const b = vec(config.spacing / 2, (config.spacing * Math.sqrt(3)) / 2)
        const n = Math.ceil(config.outer / config.spacing) + 1
        const result: Vec[] = []

        for (let i = -n; i <= n; i++) {
            for (let j = -n; j <= n; j++) {
                const p = a.scale(i).add(b.scale(j))
                const d = p.magnitude()
                if (config.inner < d && d < config.outer) result.push(p)
            }
        }

        return result
    }

    // e に甲羅をまとわせる。甲羅は e について回りながら自機の弾を受け止めて砕け、時間が来ると砕け残った破片が外へ飛ぶ
    export function shell(e: Enemy, config: ShellConfig, angle: number) {
        const offsets = honeycomb(config)

        return remodel(e)
            .format("small-ball")
            .r(8)
            .color(COLOR)
            .speed(0)
            .duplicate(offsets.length)
            .g(function* (me, i) {
                const at = (f: number) => e.p.add(offsets[i].rotate(angle + config.spin * f))
                me.p = at(0)

                const result = yield* GenUtils.race({
                    shield: breakable(me, config.durability),
                    hold: (function* () {
                        for (let f = 0; f < config.form + config.hold + config.warn && e.life > 0; f++) {
                            me.p = at(f)

                            // 弾け飛ぶ前の明滅
                            if (f >= config.form + config.hold) {
                                me.alpha = Math.floor(f / 5) % 2 === 0 ? 1 : 0.5
                            }

                            yield
                        }
                    })(),
                })

                if (result.key === "shield" || me.life <= 0) return

                me.alpha = 1
                me.radian = me.p.sub(e.p).radian()
                yield* Behavior.accel(me, 40, config.shardSpeed)
            })
            .appear(config.form)
    }
}
