import { GenUtils } from "@ipota/functions"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 高速移動は「場所を移る」装備。
// 短く・頻繁に使え、薄い壁を一瞬で突き抜けるのが得意。
// 弾は一つも消さないので、抜けた先に居場所がなければ意味がない。
// レーザーを貫通できる唯一の技
// 制御できないくらい速くする
const 持続フレーム = 18
const クールダウンフレーム = 360
const 速度 = 100

export const dash: SubEquipment = {
    label: "高速移動",
    description: "一瞬だけ高速移動する。高速移動中は無敵になる。",
    price: 0,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action")) {
                // クールタイムはダッシュ中も含めて進める
                player.scripts.add(() => burst(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

function* burst(player: Player): Generator<void, void, void> {
    player.boostSpeed = 速度
    player.isActionInvincible = true
    player.game.se.dash.play()

    yield* GenUtils.waitFrames(持続フレーム)

    player.boostSpeed = undefined
    player.isActionInvincible = false
}
