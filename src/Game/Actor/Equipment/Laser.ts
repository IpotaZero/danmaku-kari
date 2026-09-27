import { vec } from "@ipota/vec"
import { T } from "../../../T"
import { GenUtils } from "../../../utils/Functions/GeneratorUtils"
import { Remodel, remodel } from "../../Remodel"
import type { Player } from "../Player"
import type { MainEquipment } from "./types"

const ビーム本数 = 2
const 通常時間隔 = 180
const 集中時間隔 = 30
const 間隔追従率 = 0.1
const ビーム長さ = 1200
const 通常時太さ = 3
const 集中時太さ = 3
const 通常時濃さ = 0.1
const 集中時濃さ = 0.1
const 通常時威力 = 1
const 集中時威力 = 1

// 自機の左右2本、細く長いビームを常時出し続ける。自機狙いをせず一直線にしか飛ばないため、
// 敵の正面に自機を移動させて撃ち合わせないと当たらない
export const laser: MainEquipment = {
    label: "光線",
    description:
        "自機の左右から常時レーザーを出し続ける。低速時は幅が狭くなる。自機狙いをしないので、敵の正面に自機を移動させないと当たらない。",
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

                // 間隔はここに向かって毎フレーム少しずつ近づける(スナップさせず滑らかに変化させる)
                let interval = 通常時間隔

                while (true) {
                    // 低速時は狭く強く、通常時は広く弱くなる
                    const isFocused = player.game.input.isPressed("slow")
                    const targetInterval = isFocused ? 集中時間隔 : 通常時間隔
                    interval += (targetInterval - interval) * 間隔追従率

                    // 画面外に出ると弾のboundary判定で消えてしまうため、画面内に収まる位置にクランプする
                    const x = Math.max(0, Math.min(player.game.WIDTH, player.p.x + side * interval))
                    me.p = vec(x, player.p.y)
                    me.r = isFocused ? 集中時太さ : 通常時太さ
                    me.alpha = isFocused ? 集中時濃さ : 通常時濃さ
                    me.damage = isFocused ? 集中時威力 : 通常時威力

                    yield
                }
            })
            .fire(player.game.bullets)

        // ビームだけだと寂しいので、見た目の違う弾を2種類、別のリズムで並行に撃ち続ける
        yield* GenUtils.all({
            ball: 球弾を撃ち続ける(player),
            ring: リング弾を撃ち続ける(player),
        })
    },
}

const 球弾間隔 = 12
const 球弾速度 = 26
const 球弾半径 = 3
const 球弾威力 = 1

// ビームの間(自機の正面)を埋める、速く小さい球弾
function* 球弾を撃ち続ける(player: Player): Generator<void, void, void> {
    while (true) {
        if (!player.game.isGameOver) {
            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .type("friend")
                .color("white")
                .alpha(0.7)
                .appearance("ball")
                .r(球弾半径)
                .damage(球弾威力)
                .speed(球弾速度)
                .fire(player.game.bullets)
        }

        yield* GenUtils.waitFrames(球弾間隔)
    }
}

const リング弾間隔 = 6
const リング弾速度 = 10
const リング弾半径 = 8
const リング弾威力 = 2
const リング弾数 = 3
const リング弾展開角度 = T / 10

// 低速で広がっていく、輪っか状のリング弾。球弾より遅くまとまった見た目にする
function* リング弾を撃ち続ける(player: Player): Generator<void, void, void> {
    while (true) {
        if (!player.game.isGameOver) {
            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .type("friend")
                .color("white")
                .alpha(0.4)
                .appearance("arrow")
                .r(16)
                .damage(リング弾威力)
                .speed(0)
                .shift(リング弾数, 60)
                .g((me) => Remodel.accel(me, 30, 24))
                .fire(player.game.bullets)
        }

        yield* GenUtils.waitFrames(リング弾間隔)
    }
}
