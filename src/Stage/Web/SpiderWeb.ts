import { Vec, vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { T } from "../../T"
import { Actor } from "../../Game/Actor/Actor"
import { Game } from "../../Game/Game"
import { Behavior, Remodel } from "../../Game/Remodel"

// 弾を並べた蜘蛛の巣。
// 巣は薄い影(当たり判定なし)として現れ、少し後に実体になる。レーザーの予告線と同じ扱い。
// 現れ方は二通り。cast は小さく畳んで投げ、広がりながら着地させる。weave はその場で中心から外へ編んでいく。
export namespace SpiderWeb {
    export type Config = {
        // 縦糸の本数と、横糸の輪の数・間隔
        spokes: number
        rings: number
        ringGap: number
        // 糸を構成する弾の間隔
        spacing: number
        // 巣ができあがるまでの時間(castなら飛んでいる時間、weaveなら編んでいる時間)、
        // できあがってから実体になるまでの時間(この二つが巣の提示)、実体でいる時間
        flightFrames: number
        landFrames: number
        solidFrames: number
    }

    // 投げたときの畳まれ具合。着地までに1倍へ広がる
    const FOLDED = 0.2

    export function radius(config: Config) {
        return config.ringGap * config.rings
    }

    // 巣の形。中心から見た弾の位置を返す。
    // 縦糸は中心から放射状に、横糸は隣り合う縦糸どうしを直線で結ぶ(本物の蜘蛛の巣と同じく多角形になる)
    export function shape(config: Config): Vec[] {
        const { spokes, rings, ringGap, spacing } = config
        const result: Vec[] = []

        for (let k = 0; k < spokes; k++) {
            const spoke = vec.arg((T * k) / spokes)

            for (let d = spacing; d <= radius(config); d += spacing) {
                result.push(spoke.scale(d))
            }
        }

        for (let ring = 1; ring <= rings; ring++) {
            const r = ringGap * ring

            for (let k = 0; k < spokes; k++) {
                const from = vec.arg((T * k) / spokes).scale(r)
                const edge = vec
                    .arg((T * (k + 1)) / spokes)
                    .scale(r)
                    .sub(from)
                const count = Math.max(1, Math.ceil(edge.magnitude() / spacing))

                // 縦糸の弾は横糸の輪とちょうど重なる位置にあるとは限らないので、角(縦糸との交点)にも弾を置く
                for (let j = 0; j < count; j++) {
                    result.push(from.add(edge.scale(j / count)))
                }
            }
        }

        return result
    }

    // 巣が画面の外にはみ出すと、その糸はBulletのboundaryで消えてしまうので、着地点を画面の内側に収める。
    // 上の方は敵がいるので、画面の35%より下に収める
    export function landing(game: Game, near: Vec, config: Config) {
        const r = radius(config)

        return vec(
            Math.min(Math.max(near.x, r), game.WIDTH - r),
            Math.min(Math.max(near.y, game.HEIGHT * 0.35), game.HEIGHT - r),
        )
    }

    // start から target へ巣を投げる。angle は巣の向き
    export function cast<Parent extends Actor>(
        r: Remodel<Parent>,
        config: Config,
        start: Vec,
        target: Vec,
        angle: number,
    ) {
        const offsets = shape(config).map((o) => o.rotate(angle))

        return r
            .format("small-ball")
            .type("neutral")
            .alpha(0.3)
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = start.add(offsets[i].scale(FOLDED))
                return b
            })
            .g(function* (me, i) {
                for (let f = 1; f <= config.flightFrames; f++) {
                    const t = Ease.Out(f / config.flightFrames)
                    me.p = start.add(target.sub(start).scale(t)).add(offsets[i].scale(FOLDED + (1 - FOLDED) * t))
                    yield
                }

                yield* Array(config.landFrames)

                // ここから当たり判定が生まれる。見た目もはっきりさせる
                me.type = "enemy"
                me.alpha = 1
                yield* Array(config.solidFrames)

                yield* Behavior.fadeout(me, 20)
            })
    }

    // center を中心に、その場で巣を編む。中心に近い糸から順に現れる。
    // 画面の外にはみ出す糸は最初から置かないので、画面全体を覆うような大きな巣も張れる
    export function weave<Parent extends Actor>(
        r: Remodel<Parent>,
        config: Config,
        game: Game,
        center: Vec,
        angle: number,
    ) {
        const offsets = shape(config)
            .map((o) => o.rotate(angle))
            .filter((o) => {
                const p = center.add(o)
                return 0 <= p.x && p.x <= game.WIDTH && 0 <= p.y && p.y <= game.HEIGHT
            })
        const farthest = Math.max(...offsets.map((o) => o.magnitude()))

        return r
            .format("small-ball")
            .type("neutral")
            .alpha(0.3)
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = center.add(offsets[i])
                b.delay = Math.floor((offsets[i].magnitude() / farthest) * config.flightFrames)
                return b
            })
            .g(function* (me) {
                // どの糸も同じフレームに実体になる
                yield* Array(config.flightFrames - me.delay + config.landFrames)

                me.type = "enemy"
                me.alpha = 1
                yield* Array(config.solidFrames)

                yield* Behavior.fadeout(me, 20)
            })
    }
}
