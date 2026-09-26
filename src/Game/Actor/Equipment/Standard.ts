import { T } from "../../../T"
import { remodel } from "../../Remodel"
import type { MainEquipment } from "./types"

const 連射間隔 = 6
const 弾速 = 20
const 弾半径 = 3
const 弾威力 = 2

// 現状の攻撃の仕方(通常5way、低速時はshift撃ち)
export const standard: MainEquipment = {
    label: "スタンダード",
    description: "通常時は前方に5way、低速時は正面に並んだ弾を落とす。癖のない汎用的な主装備。",
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
                .r(弾半径)
                .damage(弾威力)
                .shift(5, 20)
                .speed(弾速)
                .fire(player.game.bullets)
        } else {
            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .appearance("player")
                .type("friend")
                .color("white")
                .alpha(0.5)
                .r(弾半径)
                .damage(弾威力)
                .nway(5, T / 32)
                .speed(弾速)
                .fire(player.game.bullets)
        }
        yield* Array(連射間隔)
    },
}
