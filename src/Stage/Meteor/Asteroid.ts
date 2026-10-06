import { Vec, vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 流星道場主の「迎撃」。
// 空から隕石が落ちてくる。隕石は自機の弾で撃ち砕ける(レーザーは素通りする)。大きな隕石は砕けると二つ三つの小さな隕石に割れ、
// 一番小さな隕石は砕けると光の粒になって消える。
// 撃ち漏らした隕石が地面(画面の底)に落ちると、そこから上へ向かって破片が扇形に飛び散る。大きいほど破片は多い。
// 道場主を撃つか、隕石を撃ち落とすか。撃ち落とすほど、後が楽になる
export namespace Asteroid {
    export type Size = 0 | 1 | 2 | 3

    // 大きさごとの、半径・砕けるまでに受け止める威力・落ちたときの破片の数・割れてできる隕石の数・色
    const SIZES = [
        { r: 10, durability: 5, shards: 6, pieces: 0, color: "#ffe6b8" },
        { r: 18, durability: 14, shards: 10, pieces: 2, color: "#ffc890" },
        { r: 30, durability: 36, shards: 16, pieces: 2, color: "#ff9a70" },
        { r: 64, durability: 170, shards: 30, pieces: 3, color: "#ff7050" },
    ] as const
    const HIT_COLOR: Color = "#ffffff"
    const SHARD_COLOR: Color = "#ffd0a0"
    // 割れた隕石が広がる角度と、速くなる割合
    const SPLIT_SPREAD = 0.55
    const SPLIT_BOOST = 1.25
    const SHARD_SPEED = 2.4

    // 自機の弾 b が、この1フレームで動いた線分のどこかで隕石 me に触れたかどうか
    function struck(me: Bullet, b: Bullet) {
        const reach = me.r + b.r + b.speed
        if (Math.abs(b.p.x - me.p.x) > reach || Math.abs(b.p.y - me.p.y) > reach) return false

        const start = b.p.sub(vec.arg(b.radian).scale(b.speed))
        const edge = b.p.sub(start)
        const length = edge.magnitudeSquared()
        const t = length === 0 ? 0 : Math.min(Math.max(me.p.sub(start).dot(edge) / length, 0), 1)
        return start.add(edge.scale(t)).sub(me.p).magnitudeSquared() < (me.r + b.r) ** 2
    }

    // 大きさ size の隕石を、p から向き radian・速さ speed で落とす
    export function drop(e: Enemy, size: Size, p: Vec, radian: number, speed: number): Remodel<Enemy> {
        const spec = SIZES[size]

        return remodel(e)
            .format("big-ball")
            .r(spec.r)
            .color(spec.color)
            .p(p.clone())
            .radian(radian)
            .speed(speed)
            .unbounded()
            .g(function* (me): Generator<void, void, void> {
                let rest: number = spec.durability
                let flash = 0

                while (me.life > 0) {
                    for (const b of e.game.bullets) {
                        if (b.type === "friend" && b.collision !== "rect" && b.life > 0 && struck(me, b)) {
                            b.life = 0
                            rest -= b.damage
                            flash = 3
                        }
                    }

                    me.color = flash-- > 0 ? HIT_COLOR : spec.color

                    if (rest <= 0) {
                        yield* shatter(e, size, me)
                        me.life = 0
                        return
                    }

                    if (me.p.y + me.r >= e.game.HEIGHT) {
                        yield* impact(e, size, me.p)
                        me.life = 0
                        return
                    }

                    // 横へ逸れて画面の外へ出たものは、そのまま消える
                    if (me.p.x < -me.r * 2 || e.game.WIDTH + me.r * 2 < me.p.x) {
                        me.life = 0
                        return
                    }

                    yield
                }
            })
    }

    // 撃ち砕かれた。小さな隕石に割れるか、光の粒になって消える
    function* shatter(e: Enemy, size: Size, me: Bullet): Generator<void, void, void> {
        const spec = SIZES[size]

        if (spec.pieces === 0) {
            yield* remodel(e)
                .format("small-ball")
                .r(3)
                .type("effect")
                .isScorable(false)
                .color("#fff4d0")
                .p(me.p.clone())
                .speed(2)
                .radian(e.random() * T)
                .ex(8)
                .g(function* (spark) {
                    yield* Behavior.ease(spark, "alpha", 0, 30)
                    spark.life = 0
                })
                .fire(e.game.bullets)
            return
        }

        for (let k = 0; k < spec.pieces; k++) {
            const offset = SPLIT_SPREAD * (k - (spec.pieces - 1) / 2) * (2 / Math.max(1, spec.pieces - 1))
            const p = me.p.add(vec.arg(me.radian + T / 4).scale((k - (spec.pieces - 1) / 2) * spec.r * 0.8))

            yield* drop(e, (size - 1) as Size, p, me.radian + offset, Math.max(me.speed, 0.8) * SPLIT_BOOST).fire(
                e.game.bullets,
            )
        }
    }

    // 地面に落ちた。落ちた所から、上へ向かって破片を扇形に飛び散らせる。大きな隕石ほど破片が多く、何度も飛び散る
    function* impact(e: Enemy, size: Size, p: Vec) {
        const spec = SIZES[size]
        const ground = vec(p.x, e.game.HEIGHT - 4)

        if (size >= 2) e.game.camera.shake(4 + 4 * (size - 1), 20)

        for (let wave = 0; wave < Math.max(1, size); wave++) {
            yield* remodel(e)
                .format("small-ball")
                .r(5)
                .color(SHARD_COLOR)
                .p(ground)
                .speed(SHARD_SPEED * (1 + 0.25 * wave))
                .radian(-T / 4 + (wave % 2) * (T / 2 / spec.shards))
                .nway(spec.shards, T / 2 / (spec.shards - 1))
                .fire(e.game.bullets)
        }
    }
}
