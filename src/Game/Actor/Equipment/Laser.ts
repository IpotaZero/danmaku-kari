import { vec } from "@ipota/vec"
import { T } from "../../../T"
import { remodel } from "../../Remodel"
import type { MainEquipment } from "./types"

const ビーム本数 = 2
const ビーム間隔 = 40
const ビーム長さ = 900
const 通常時太さ = 14
const 集中時太さ = 5
const 通常時濃さ = 0.3
const 集中時濃さ = 0.6
const 通常時威力 = 1
const 集中時威力 = 3

// 自機の左右2本、細く長いビームを常時出し続ける。自機狙いをせず一直線にしか飛ばないため、
// 敵の正面に自機を移動させて撃ち合わせないと当たらない
export const laser: MainEquipment = {
    label: "レーザー",
    description:
        "自機の左右2本から常時レーザーを出し続ける。通常は幅が広く当てやすい代わりに威力は控えめ、低速時は幅が狭くなる代わりに威力が上がる。自機狙いをしないので、敵の正面に自機を移動させないと当たらない。",
    *fire(player) {
        while (!player.game.isPlaying) yield

        // 一度出したら消えない常設ビームなので、生成は最初の1回だけ
        yield* remodel(player)
            .p(player.p.clone())
            .radian(-T / 4)
            .type("friend")
            .color("white")
            .alpha(通常時濃さ)
            .appearance("beam")
            .collision("laser")
            .r(通常時太さ)
            .damage(通常時威力)
            .length(ビーム長さ)
            .speed(0)
            .duplicate(ビーム本数, (b) => b)
            .g(function* (me, index) {
                // 2本の間隔はこのオフセット分だけ左右に開く
                const side = index - (ビーム本数 - 1) / 2

                while (true) {
                    me.p = player.p.clone().add(vec(side * ビーム間隔, 0))

                    // 低速時は狭く強く、通常時は広く弱くなる
                    const isFocused = player.game.input.isPressed("slow")
                    me.r = isFocused ? 集中時太さ : 通常時太さ
                    me.alpha = isFocused ? 集中時濃さ : 通常時濃さ
                    me.damage = isFocused ? 集中時威力 : 通常時威力

                    yield
                }
            })
            .fire(player.game.bullets)

        // ここに戻ってくることはないが、Playerのloop:Infinityによる再実行を防ぐため待ち続ける
        while (true) yield
    },
}
