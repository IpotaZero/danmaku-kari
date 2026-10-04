import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Ctx } from "../../utils/Functions/Ctx"
import { MathEx } from "../../utils/Functions/MathEx"

// 陽炎道場の「蜃気楼」。
// 鏡の線(center を通る angle 向きの線)を挟んで、敵の弾はすべて鏡写しの双子を持つ(Remodel.mirror)。
// 双子を撃つのは鏡の向こうに映った敵の幻なので、幻と鏡の線を薄く描いて、どこから弾が来るかを分かるようにする。
// 幻は描かれるだけで、撃っても当たらない
export namespace Mirage {
    const COLOR = "rgba(255, 210, 160, 0.35)"
    const LINE_COLOR = "rgba(255, 210, 160, 0.12)"

    // e が生きている間ずっと、鏡の線と、鏡に映った e の幻を描く
    export function* show(e: Enemy, center: Vec, angle: number) {
        const reach = vec.arg(angle).scale(e.game.WIDTH + e.game.HEIGHT)

        while (e.life > 0) {
            const ghost = MathEx.reflect(e.p, center, angle)
            const r = e.r
            const theta = -e.frame / 60

            e.game.drawInWorld((ctx) => {
                ctx.beginPath()
                ctx.moveTo(center.x - reach.x, center.y - reach.y)
                ctx.lineTo(center.x + reach.x, center.y + reach.y)
                ctx.strokeStyle = LINE_COLOR
                ctx.lineWidth = 2
                ctx.stroke()

                Ctx.arc(ctx, ghost, r * 1.1, COLOR, { lineWidth: 1 })
                Ctx.arc(ctx, ghost, r, COLOR, { lineWidth: 1 })
                Ctx.polygon(ctx, 5, 2, ghost, r * 0.85, COLOR, { theta, lineWidth: 1 })
            })

            yield
        }
    }
}
