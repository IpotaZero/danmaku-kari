import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { T } from "../../../T"
import { Ctx } from "../../../utils/Functions/Ctx"
import type { Player } from "../Player"

const 演出フレーム = 45

// クールタイムが明けた瞬間に、広がるリングと"CHARGED"の文字を表示する
export function* actionReadyEffect(player: Player): Generator<void, void, void> {
    const ctx = player.game.ctx

    for (let i = 1; i <= 演出フレーム; i++) {
        const progress = i / 演出フレーム
        const alpha = 1 - progress
        const r = Ease.Out(progress) * player.GRAZE_R * 5

        ctx.save()
        player.game.camera.apply(ctx, player.game.WIDTH, player.game.HEIGHT)
        ctx.globalAlpha = alpha

        Ctx.arc(ctx, player.p, r, "#ffffffc0", { lineWidth: 2 })
        Ctx.arc(ctx, player.p, r + player.GRAZE_R * 0.3, "#ffffffc0", { lineWidth: 2 })
        Ctx.arc(ctx, player.p, r / 2, "#ffffffc0", { lineWidth: 2 })

        const text = [..."CHARGED"]
        text.forEach((c, index) => {
            const charP = player.p.add(vec.arg(T * (index / text.length)).scale(player.GRAZE_R * 3))
            Ctx.text(ctx, charP, "#ffffff80", c, { fontFamily: "dot", fontSize: player.GRAZE_R })
        })

        ctx.restore()
        yield
    }
}
