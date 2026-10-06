import { Vec, vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 鉄壁道場主の「反射装甲」。
// 装甲板は、弾を板の形に並べたもの(触れれば被弾する)。板に当たった自機の弾は消え、代わりに板に跳ね返された敵の弾が飛んでくる。
// 弾は鏡のように跳ね返るので、真上へ撃てば真下へ、つまり自分のいる所へ返ってくる。撃ってよいのは板の隙間だけ。
// 敵の弾の中には、板で跳ね返るものもある(bounce)
export namespace Armor {
    const COLOR: Color = "#c8d4e8"
    const REFLECTED: Color = "#ff9a7a"
    // 板の見た目の弾の間隔と大きさ。板の厚みの半分はこの大きさ
    const SPACING = 10
    const THICKNESS = 6
    // 跳ね返された弾の速さと、一枚の板が跳ね返す間隔(これより短い間に当たった自機の弾は、跳ね返らずに消えるだけ)
    const REFLECT_SPEED = 3.2
    const REFLECT_INTERVAL = 5

    export class Plate {
        // center を真ん中に、向き angle で、長さ half * 2 の板
        constructor(
            public center: Vec,
            public angle: number,
            readonly half: number,
        ) {}

        ends(): [Vec, Vec] {
            const d = vec.arg(this.angle).scale(this.half)
            return [this.center.sub(d), this.center.add(d)]
        }

        normal(): Vec {
            return vec.arg(this.angle + T / 4)
        }
    }

    // 点 p に一番近い、線分 ab の上の点
    function closest(p: Vec, a: Vec, b: Vec): Vec {
        const ab = b.sub(a)
        const length = ab.magnitudeSquared()
        const t = length === 0 ? 0 : Math.min(Math.max(p.sub(a).dot(ab) / length, 0), 1)
        return a.add(ab.scale(t))
    }

    // 線分 pq と線分 ab の距離
    function distance(p: Vec, q: Vec, a: Vec, b: Vec): number {
        const cross = (o: Vec, u: Vec, v: Vec) => u.sub(o).cross(v.sub(o))
        const intersect =
            Math.sign(cross(p, q, a)) !== Math.sign(cross(p, q, b)) &&
            Math.sign(cross(a, b, p)) !== Math.sign(cross(a, b, q))
        if (intersect) return 0

        return Math.min(
            p.sub(closest(p, a, b)).magnitude(),
            q.sub(closest(q, a, b)).magnitude(),
            a.sub(closest(a, p, q)).magnitude(),
            b.sub(closest(b, p, q)).magnitude(),
        )
    }

    // 弾 b がこの1フレームで動いた線分が、板 plate に触れたかどうか
    function touches(b: Bullet, plate: Plate) {
        // 板はいくつもあるので、明らかに遠い弾はベクトルを作らずに先に除く
        const reach = plate.half + THICKNESS + b.r + b.speed
        if (Math.abs(b.p.x - plate.center.x) > reach || Math.abs(b.p.y - plate.center.y) > reach) return false

        const before = b.p.sub(vec.arg(b.radian).scale(b.speed))
        const [a, c] = plate.ends()
        return distance(before, b.p, a, c) < THICKNESS + b.r
    }

    // 弾 b を、板 plate で鏡のように跳ね返した向き
    function reflect(b: Bullet, plate: Plate) {
        const v = vec.arg(b.radian)
        const n = plate.normal()
        return v.sub(n.scale(2 * v.dot(n))).radian()
    }

    // 板 plate を、弾を並べて描く。板が動けば弾もついていく。alive() が偽になると消える
    export function build(e: Enemy, plate: Plate, alive: () => boolean) {
        const count = Math.ceil((plate.half * 2) / SPACING) + 1

        return remodel(e)
            .format("diamond")
            .r(THICKNESS + 2)
            .color(COLOR)
            .speed(0)
            .duplicate(count)
            .appear(20)
            .unbounded()
            .g(function* (me, i) {
                const along = -plate.half + (plate.half * 2 * i) / (count - 1)

                while (alive() && me.life > 0) {
                    me.p = plate.center.add(vec.arg(plate.angle).scale(along))
                    me.radian = plate.angle
                    yield
                }

                me.type = "neutral"
                for (let f = 1; f <= 20; f++) {
                    me.alpha = 1 - f / 20
                    yield
                }
                me.life = 0
            })
    }

    // alive() が真の間、板 plates に当たった自機の弾(レーザー以外)を消し、跳ね返った敵の弾を撃ち返す
    export function* guard(e: Enemy, plates: () => readonly Plate[], alive: () => boolean) {
        const last = new Map<Plate, number>()

        for (let f = 0; alive(); f++) {
            for (const b of e.game.bullets) {
                if (b.type !== "friend" || b.collision === "rect" || b.life <= 0) continue

                for (const plate of plates()) {
                    if (!touches(b, plate)) continue

                    b.life = 0

                    if (f - (last.get(plate) ?? -Infinity) >= REFLECT_INTERVAL) {
                        last.set(plate, f)

                        // 板の、弾が来た側の面から撃ち返す
                        const n = plate.normal()
                        const side = Math.sign(b.p.sub(plate.center).dot(n)) || 1
                        const [a, c] = plate.ends()
                        const p = closest(b.p, a, c).add(n.scale(side * (THICKNESS + 8)))

                        yield* remodel(e)
                            .format("small-ball")
                            .r(5)
                            .color(REFLECTED)
                            .p(p)
                            .radian(reflect(b, plate))
                            .speed(REFLECT_SPEED)
                            .fire(e.game.bullets)
                    }

                    break
                }
            }

            yield
        }
    }

    // 敵の弾 me を、板 plates で最大 times 回跳ね返らせる
    export function* bounce(me: Bullet, plates: () => readonly Plate[], times: number) {
        for (let left = times; left > 0 && me.life > 0;) {
            for (const plate of plates()) {
                if (!touches(me, plate)) continue

                me.radian = reflect(me, plate)
                // 板にめり込んだままにならないよう、跳ね返った向きへ少し押し出す
                me.p = me.p.add(vec.arg(me.radian).scale(THICKNESS + me.r))
                left--
                break
            }

            yield
        }
    }
}
