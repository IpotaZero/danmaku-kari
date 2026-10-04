import { Vec, vec } from "@ipota/vec"
import { Actor } from "../../Game/Actor/Actor"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Remodel } from "../../Game/Remodel"
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

    // すべての鏡に映して、弾を 2^(鏡の数) 個にする。挙動を付け終えた後、fire の直前に呼ぶ
    export function reflect<P extends Actor>(r: Remodel<P>, mirrors: readonly Mirror[]) {
        return mirrors.reduce((result, m) => result.mirror(m.center, m.angle), r)
    }

    // e が生きている間ずっと、鏡の線を描く
    export function* lines(e: Enemy, mirrors: readonly Mirror[]) {
        const reach = e.game.WIDTH + e.game.HEIGHT

        while (e.life > 0) {
            e.game.drawInWorld((ctx) => {
                for (const { center, angle } of mirrors) {
                    const d = vec.arg(angle).scale(reach)
                    ctx.beginPath()
                    ctx.moveTo(center.x - d.x, center.y - d.y)
                    ctx.lineTo(center.x + d.x, center.y + d.y)
                    ctx.strokeStyle = LINE_COLOR
                    ctx.lineWidth = 2
                    ctx.stroke()
                }
            })

            yield
        }
    }

    // e が生きている間ずっと、鏡に映った e の幻を描く。
    // 鏡が複数あるときは、鏡に映った幻がさらに別の鏡に映った幻も描く(Remodel.mirror を重ねたときの双子の双子)
    export function* ghosts(e: Enemy, mirrors: readonly Mirror[]) {
        while (e.life > 0) {
            const points = mirrors
                .reduce((points, m) => [...points, ...points.map((q) => MathEx.reflect(q, m.center, m.angle))], [e.p])
                .slice(1)
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
