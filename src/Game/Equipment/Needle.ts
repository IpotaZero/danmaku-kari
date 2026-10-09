import { T } from "../../T"
import { Behavior, remodel } from "../Remodel"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 大針は「一点を穿つ」装備。
// 真上へ大きな針を一本だけ飛ばし、最初に触れた敵に大きな傷を与える。
// 貫かないので、どの部位に当てるかを狙って撃つことになる。
const 針半径 = 56
const 針威力 = 200
const 初速 = 2
const 最終速度 = 36
const 加速フレーム = 20
const クールダウンフレーム = 360

export const needle: SubEquipment = {
    label: "大針",
    description: "真上へ大きな針を飛ばす。最初に触れた敵ひとつに大きな傷を与える。",
    price: 5000,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action") && !player.game.isGameOver) {
                player.addScript(() => shoot(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

// 撃った瞬間はゆっくり、すぐに速くなる。どこへ飛んだかを目で追えるようにする
function* shoot(player: Player): Generator<void, void, void> {
    player.game.se.dash.play()

    yield* remodel(player)
        .p(player.p.clone())
        .radian(-T / 4)
        .type("friend")
        .appearance("diamond")
        .collision("diamond")
        .r(針半径)
        .color("white")
        .alpha(0.8)
        .damage(針威力)
        .speed(初速)
        .g((me) => Behavior.accel(me, 加速フレーム, 最終速度))
        .fire(player.game.bullets)
}
