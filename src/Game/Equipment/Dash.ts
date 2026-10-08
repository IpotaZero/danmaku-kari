import { actionReadyEffect } from "./ActionReadyEffect"
import type { SubEquipment } from "./types"

// 羽ばたきは「場所を移る」装備。
// 短く・頻繁に使え、薄い壁を一瞬で突き抜けるのが得意。
// 弾は一つも消さないので、抜けた先に居場所がなければ意味がない。
const 持続フレーム = 18
const クールダウンフレーム = 960
const 速度倍率 = 7

export const dash: SubEquipment = {
    label: "羽ばたき",
    description: "一瞬だけ速く飛ぶ。そのあいだは何にも当たらない。",
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
                player.game.se.dash.play()
            }

            yield
        }
    },
}
