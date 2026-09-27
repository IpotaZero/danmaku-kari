import { actionReadyEffect } from "./ActionReadyEffect"
import type { SubEquipment } from "./types"

const 持続フレーム = 30
const クールダウンフレーム = 120
const 速度倍率 = 5

// actionボタンで短時間ダッシュ(その間は移動速度アップ+無敵)。クールダウン中は再発動しない
export const dash: SubEquipment = {
    label: "高速移動",
    description: "actionボタンで短時間高速移動する。高速移動中は移動速度が上がり、無敵になる。",
    *action(player) {
        let cooldown = 0
        let burstFramesRemaining = 0

        while (true) {
            // クールタイムはダッシュ中も含め毎フレーム進める
            if (cooldown > 0) {
                cooldown--
                player.actionCooldownRemaining = cooldown / クールダウンフレーム

                if (cooldown === 0) {
                    player.addScript(() => actionReadyEffect(player), { id: crypto.randomUUID() })
                }
            }

            if (burstFramesRemaining > 0) {
                burstFramesRemaining--

                if (burstFramesRemaining === 0) {
                    player.speedMultiplier = 1
                    player.isActionInvincible = false
                }
            } else if (cooldown === 0 && player.game.input.isPushed("action")) {
                cooldown = クールダウンフレーム
                burstFramesRemaining = 持続フレーム
                player.actionCooldownRemaining = 1
                player.speedMultiplier = 速度倍率
                player.isActionInvincible = true
            }

            yield
        }
    },
}
