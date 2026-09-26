import { T } from "../../T"
import { EquipmentId } from "../../Data/Equipment"
import { remodel } from "../Remodel"
import type { Player } from "./Player"

// 主装備: 攻撃の仕方に対応する
export type MainEquipment = {
    fire(player: Player): Generator<void, void, void>
}

// 副装備: action入力時の挙動に対応する
export type SubEquipment = {
    action(player: Player): Generator<void, void, void>
}

const STANDARD_FIRE_COOLDOWN = 6
const STANDARD_BULLET_SPEED = 20
const STANDARD_BULLET_R = 3

export const mainEquipments: Record<EquipmentId, MainEquipment> = {
    // 現状の攻撃の仕方(通常5way、低速時はshift撃ち)
    standard: {
        *fire(player) {
            if (!player.game.isPlaying) {
                yield
                return
            }

            if (player.game.input.isPressed("slow")) {
                yield* remodel(player)
                    .p(player.p.clone())
                    .radian(-T / 4)
                    .appearance("player")
                    .type("friend")
                    .color("white")
                    .alpha(0.5)
                    .r(STANDARD_BULLET_R)
                    .shift(5, 20)
                    .speed(STANDARD_BULLET_SPEED)
                    .fire(player.game.bullets)
            } else {
                yield* remodel(player)
                    .p(player.p.clone())
                    .radian(-T / 4)
                    .appearance("player")
                    .type("friend")
                    .color("white")
                    .alpha(0.5)
                    .r(STANDARD_BULLET_R)
                    .nway(5, T / 32)
                    .speed(STANDARD_BULLET_SPEED)
                    .fire(player.game.bullets)
            }
            yield* Array(STANDARD_FIRE_COOLDOWN)
        },
    },
}

const DASH_FRAME = 30
const DASH_COOLDOWN_FRAME = 60
const DASH_SPEED_MULTIPLIER = 3

export const subEquipments: Record<EquipmentId, SubEquipment> = {
    // actionボタンで短時間ダッシュ(その間は移動速度アップ+無敵)。クールダウン中は再発動しない
    dash: {
        *action(player) {
            let cooldown = 0

            while (true) {
                if (cooldown > 0) cooldown--

                if (cooldown === 0 && player.game.input.isPushed("action")) {
                    cooldown = DASH_COOLDOWN_FRAME
                    yield* dashBurst(player)
                } else {
                    yield
                }
            }
        },
    },
}

function* dashBurst(player: Player): Generator<void, void, void> {
    player.speedMultiplier = DASH_SPEED_MULTIPLIER
    player.isActionInvincible = true

    yield* Array(DASH_FRAME)

    player.speedMultiplier = 1
    player.isActionInvincible = false
}
