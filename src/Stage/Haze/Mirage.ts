import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { MathEx } from "../../utils/Functions/MathEx"

// 陽炎道場の「蜃気楼」。
// 鏡の線(center を通る angle 向きの線)を挟んで、敵の弾はすべて鏡写しの双子を持つ(Remodel.mirror)。
// 双子を撃つのは鏡の向こうに映った敵の幻なので、幻と鏡の線を薄く描いて、どこから弾が来るかを分かるようにする。
// 幻は描かれるだけで、撃っても当たらない
export namespace Mirage {
    const COLOR = "rgba(255, 210, 160, 0.35)"
    const LINE_COLOR = "rgba(255, 210, 160, 0.12)"

    export type Mirror = { center: Vec; angle: number }

    // 画面の真ん中を横に通る鏡
    export function horizontal(game: Game): Mirror {
        return { center: vec(game.WIDTH / 2, game.HEIGHT / 2), angle: 0 }
    }

    // 画面の真ん中を縦に通る鏡
    export function vertical(game: Game): Mirror {
        return { center: vec(game.WIDTH / 2, game.HEIGHT / 2), angle: T / 4 }
    }

    // 画面を縦と横に仕切る二枚の鏡
    export function cross(game: Game): Mirror[] {
        return [horizontal(game), vertical(game)]
    }

    // 鏡の線を、center から両側へ length ずつ伸ばして描く
    function stroke(
        ctx: CanvasRenderingContext2D,
        { center, angle }: Mirror,
        length: number,
        color: string,
        width: number,
    ) {
        const d = vec.arg(angle).scale(length)
        ctx.beginPath()
        ctx.moveTo(center.x - d.x, center.y - d.y)
        ctx.lineTo(center.x + d.x, center.y + d.y)
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.stroke()
    }

    // e が生きている間ずっと、鏡の線を描く
    export function* lines(e: Enemy, mirrors: readonly Mirror[]) {
        const reach = e.game.WIDTH + e.game.HEIGHT

        while (e.life > 0) {
            e.game.drawInWorld((ctx) => {
                for (const mirror of mirrors) stroke(ctx, mirror, reach, LINE_COLOR, 2)
            })

            yield
        }
    }

    // 鏡を引く演出。鏡の線は center から両側へ frames かけて一定の速さで画面の端まで伸び、
    // 引き終わった瞬間にぱっと光ってから薄く残る。伸びている線の先には光の粒が走る。
    // 前の鏡 previous は、新しい鏡が伸びる間に薄れて消える。引き終わった後は、e が生きている間ずっと鏡の線を描き続ける
    export function* draw(e: Enemy, mirror: Mirror, previous: Mirror | undefined, frames: number) {
        const reach = e.game.WIDTH + e.game.HEIGHT
        const glowFrames = 24

        // 画面の外まで伸ばしても見えないので、伸びる演出は中心から一番遠い画面の角までにする
        const { WIDTH, HEIGHT } = e.game
        const corners = [vec(0, 0), vec(WIDTH, 0), vec(0, HEIGHT), vec(WIDTH, HEIGHT)]
        const far = Math.max(...corners.map((c) => c.sub(mirror.center).magnitude()))

        for (let f = 0; e.life > 0; f++) {
            const t = Math.min(1, f / frames)
            const length = t < 1 ? far * t : reach
            const glow = f < frames ? 0 : Math.max(0, 1 - (f - frames) / glowFrames)
            const tips = [-1, 1].map((side) => mirror.center.add(vec.arg(mirror.angle).scale(side * length)))

            e.game.drawInWorld((ctx) => {
                if (previous && t < 1) stroke(ctx, previous, reach, `rgba(255, 210, 160, ${0.12 * (1 - t)})`, 2)

                stroke(ctx, mirror, length, `rgba(255, 210, 160, ${0.12 + 0.6 * glow})`, 2 + 4 * glow)

                if (t < 1) {
                    for (const tip of tips) Ctx.arc(ctx, tip, 5, "rgba(255, 240, 210, 0.8)")
                }
            })

            yield
        }
    }

    // e が生きている間ずっと、鏡に映った e の幻を描く。
    // 鏡が複数あるときは、鏡に映った幻がさらに別の鏡に映った幻も描く(Remodel.mirror を重ねたときの双子の双子)
    export function ghosts(e: Enemy, mirrors: readonly Mirror[]) {
        return images(e, (p) =>
            mirrors
                .reduce((points, m) => [...points, ...points.map((q) => MathEx.reflect(q, m.center, m.angle))], [p])
                .slice(1),
        )
    }

    // e が生きている間ずっと、e の幻を描く。幻の位置は e の位置から places で決める
    export function* images(e: Enemy, places: (p: Vec) => Vec[]) {
        while (e.life > 0) {
            const points = places(e.p)
            const r = e.r
            const theta = -e.frame / 60

            e.game.drawInWorld((ctx) => {
                for (const ghost of points) {
                    Ctx.arc(ctx, ghost, r * 1.1, COLOR, { lineWidth: 1 })
                    Ctx.arc(ctx, ghost, r, COLOR, { lineWidth: 1 })
                    Ctx.polygon(ctx, 5, 2, ghost, r * 0.85, COLOR, { theta, lineWidth: 1 })
                }
            })

            yield
        }
    }
}
