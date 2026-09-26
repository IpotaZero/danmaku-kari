import { Ctx } from "../../../utils/Functions/Ctx"
import type { Player } from "../Player"
import { actionReadyEffect } from "./ActionReadyEffect"
import type { SubEquipment } from "./types"

const 持続フレーム = 40
const クールダウンフレーム = 240
const 半径倍率 = 12

// actionボタンで自機周囲に一定半径の弾消しバリアを展開する。クールダウン中は再発動しない
export const barrier: SubEquipment = {
    label: "バリア",
    description: "actionボタンで自機周囲に弾消しバリアを展開する。範囲内にある敵弾をスコアに変える。",
    *action(player) {
        let cooldown = 0

        while (true) {
            if (cooldown > 0) {
                cooldown--
                player.actionCooldownRemaining = cooldown / クールダウンフレーム

                if (cooldown === 0) {
                    player.addScript(() => actionReadyEffect(player), { id: crypto.randomUUID() })
                }
            } else if (player.game.input.isPushed("action")) {
                cooldown = クールダウンフレーム
                player.actionCooldownRemaining = 1
                player.addScript(() => barrierField(player), { id: crypto.randomUUID() })
            }

            yield
        }
    },
}

// 展開中、自機を中心とした固定半径内に入っている敵弾をスコアに変える
function* barrierField(player: Player): Generator<void, void, void> {
    const ctx = player.game.ctx
    const radius = player.GRAZE_R * 半径倍率

    for (let i = 1; i <= 持続フレーム; i++) {
        const progress = i / 持続フレーム
        const center = player.p

        player.game.bullets
            .filter((b) => b.type === "enemy")
            .filter((b) => b.isScorable)
            .filter((b) => b.p.sub(center).magnitude() <= radius)
            .forEach((b) => b.scorenize())

        ctx.save()
        player.game.camera.apply(ctx, player.game.WIDTH, player.game.HEIGHT)
        ctx.globalAlpha = 1 - progress
        Ctx.arc(ctx, center, radius, "#7fdfffc0", { lineWidth: 3 })
        Ctx.arc(ctx, center, radius * 0.92, "#ffffff80", { lineWidth: 1 })
        ctx.restore()

        yield
    }
}
