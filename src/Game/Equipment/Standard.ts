import { Vec } from "@ipota/vec"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { remodel } from "../Remodel"
import type { Bullet } from "../Actor/Bullet"
import type { Enemy } from "../Actor/Enemy"
import type { Player } from "../Actor/Player"
import type { MainEquipment } from "./types"

const 連射間隔 = 6
const 弾数 = 7
const 弾速 = 20
const 弾半径 = 3
const 弾威力 = 2
const 通常時展開角度 = T / 32
const 集中時展開角度 = T / 64

const ホーミング弾数 = 6
const ホーミング弾半径 = 4
const ホーミング弾速 = 18
const ホーミング弾威力 = 3
const ホーミング展開角度 = T / 8
const 追尾開始待機フレーム = 10
const 追尾継続フレーム = 50
const 角加速度 = T / 150
const 最大角速度 = T / 50

// 通常時は広いn-way、低速時は狭いn-way。どちらにも曲がるホーミング弾を、
// メインの弾とは別の間隔で添える
export const standard: MainEquipment = {
    label: "散り針",
    description: "前へ針を散らして撃ち、敵を追いかける針を添える。低速時は散りが狭くなる。",
    *fire(player) {
        // メインの弾とホーミング弾は間隔が違うので、別々のループとして並行に走らせる
        yield* GenUtils.all({
            main: mainShotLoop(player),
            homing: homingShotLoop(player),
        })
    },
}

function* mainShotLoop(player: Player): Generator<void, void, void> {
    while (true) {
        if (!player.game.isGameOver) {
            const spread = player.game.input.isPressed("slow") ? 集中時展開角度 : 通常時展開角度

            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .appearance("player")
                .type("friend")
                .color("white")
                .alpha(0.5)
                .r(弾半径)
                .damage(弾威力)
                .nway(弾数, spread)
                .speed(弾速)
                .fire(player.game.bullets)
        }

        yield* GenUtils.waitFrames(連射間隔)
    }
}

// ホーミング弾は通常/低速どちらでも同じものを、メインの弾とは別の間隔で撃つ
function* homingShotLoop(player: Player): Generator<void, void, void> {
    while (true) {
        if (!player.game.isGameOver) {
            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .appearance("arrow")
                .type("friend")
                .color("white")
                .alpha(0.2)
                .r(20)
                .damage(ホーミング弾威力)
                .speed(ホーミング弾速)
                .nway(ホーミング弾数, ホーミング展開角度)
                .g(function* (me) {
                    yield* homingSteering(player, me)
                })
                .fire(player.game.bullets)
        }

        yield* GenUtils.waitFrames(12)
    }
}

// 発射直後は展開角度がそのまま見えるよう、少し待ってから追尾を始める。
// 向きを直接ターゲットに向けるのではなく、角速度を少しずつ加えて曲げていく
function* homingSteering(player: Player, me: Bullet): Generator<void, void, void> {
    yield* GenUtils.waitFrames(追尾開始待機フレーム)

    let angularVelocity = 0

    for (let i = 0; i < 追尾継続フレーム; i++) {
        const target = nearestEnemy(player, me.p)

        if (target) {
            const diff = normalizeAngle(target.p.sub(me.p).radian() - me.radian)
            angularVelocity += Math.sign(diff) * 角加速度
            angularVelocity = Math.max(-最大角速度, Math.min(最大角速度, angularVelocity))
        }

        me.radian += angularVelocity
        yield
    }
}

// 自機に最も近い敵を探す。見つからなければundefined
function nearestEnemy(player: Player, from: Vec): Enemy | undefined {
    let nearest: Enemy | undefined
    let nearestDistSq = Infinity

    for (const enemy of player.game.enemies.filter((e) => !e.isInvincible)) {
        const distSq = enemy.p.sub(from).magnitudeSquared()
        if (distSq < nearestDistSq) {
            nearestDistSq = distSq
            nearest = enemy
        }
    }

    return nearest
}

// 角度の差を-T/2〜T/2に正規化する(どちら向きに曲げるべきかを判定するため)
function normalizeAngle(angle: number): number {
    let a = angle % T
    if (a > T / 2) a -= T
    if (a < -T / 2) a += T
    return a
}
