import { actionReadyEffect } from "./ActionReadyEffect"
import type { SubEquipment } from "./types"

// 高速移動は「場所を移る」装備。
// 短く・頻繁に使え、薄い壁を一瞬で突き抜けるのが得意。
// 弾は一つも消さないので、抜けた先に居場所がなければ意味がない。
const 持続フレーム = 18
const クールダウンフレーム = 90
const 速度倍率 = 5

export const dash: SubEquipment = {
    label: "高速移動",
    description: "一瞬だけ高速移動する。高速移動中は無敵になる。再使用までが短い。",
    *action(player) {
        let cooldown = 0
        let burstFramesRemaining = 0

        while (true) {
            // クールタイムはダッシュ中も含め毎フレーム進める
            if (cooldown > 0) {
                cooldown--
                player.actionCooldownRemaining = cooldown / クールダウンフレーム

                if (cooldown === 0) {
                    player.addScript(() => actionReadyEffect(player))
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
