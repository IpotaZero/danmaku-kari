import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import type { Player } from "../Actor/Player"

const 演出フレーム = 45

// クールタイムが明けた瞬間に、広がるリングと、まわりに放射状に並ぶ七本の光の筋を表示する。文字は使わない
export function* actionReadyEffect(player: Player): Generator<void, void, void> {
    player.game.se.charge.play()

    for (let i = 1; i <= 演出フレーム; i++) {
        const progress = i / 演出フレーム
        const alpha = 1 - progress
        const r = Ease.Out(progress) * player.GRAZE_R * 5

        player.game.drawInWorld((ctx) => {
            ctx.globalAlpha = alpha

            Ctx.arc(ctx, player.p, r, "#ffffffc0", { lineWidth: 2 })
            Ctx.arc(ctx, player.p, r + player.GRAZE_R * 0.3, "#ffffffc0", { lineWidth: 2 })
            Ctx.arc(ctx, player.p, r / 2, "#ffffffc0", { lineWidth: 2 })

            ctx.strokeStyle = "#ffffff80"
            ctx.lineWidth = 2
            for (let k = 0; k < 7; k++) {
                const direction = vec.arg(T * (k / 7) + progress)
                const from = player.p.add(direction.scale(player.GRAZE_R * 2.6))
                const to = player.p.add(direction.scale(player.GRAZE_R * 3.4))
                ctx.beginPath()
                ctx.moveTo(from.x, from.y)
                ctx.lineTo(to.x, to.y)
                ctx.stroke()
            }
        })
        yield
    }
}
