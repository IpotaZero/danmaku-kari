import { vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Behavior } from "../../Game/Remodel"

// 鉄壁道場の「盾」。盾の弾は自機の弾を受け止めて消す(レーザーは貫く)。もちろん自機が触れれば被弾する。
// 盾のすき間を通さないと、奥の敵に弾が届かない
export namespace Shield {
    export const COLOR: Color = "#c8d4e8"
    // 壊れる盾の色。削れるほど赤くなる
    const BREAKABLE_COLORS: Color[] = ["#ff8a8a", "#ffb08a", "#ffd88a", "#e8f0ff"]

    // 自機の弾が1フレームで進んだ線分が、盾に触れたかどうか。弾は速いので、すり抜けないよう線分で調べる
    function isTouching(me: Bullet, b: Bullet) {
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
}
