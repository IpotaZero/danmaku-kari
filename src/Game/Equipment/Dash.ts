import { GenUtils } from "@ipota/functions"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 高速移動は「場所を移る」装備。
// 短く・頻繁に使え、薄い壁を一瞬で突き抜けるのが得意。
// 弾は一つも消さないので、抜けた先に居場所がなければ意味がない。
// レーザーを貫通できる唯一の技
const 持続フレーム = 18
const クールダウンフレーム = 720
const 速度倍率 = 7

export const dash: SubEquipment = {
    label: "高速移動",
    description: "一瞬だけ高速移動する。高速移動中は無敵になる。",
    price: 0,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action")) {
                // クールタイムはダッシュ中も含めて進める
                player.addScript(() => burst(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

function* burst(player: Player): Generator<void, void, void> {
    player.speedMultiplier = 速度倍率
    player.isActionInvincible = true
    player.game.se.dash.play()

    yield* GenUtils.waitFrames(持続フレーム)

    player.speedMultiplier = 1
    player.isActionInvincible = false
}
