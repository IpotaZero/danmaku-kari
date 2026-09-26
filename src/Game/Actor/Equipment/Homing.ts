import { Vec } from "@ipota/vec"
import { T } from "../../../T"
import { remodel } from "../../Remodel"
import type { Bullet } from "../Bullet"
import type { Enemy } from "../Enemy"
import type { Player } from "../Player"
import type { MainEquipment } from "./types"

const 弾半径 = 4
const 弾速 = 32
const 追尾開始待機フレーム = 10
const 追尾継続フレーム = 50
const 連射間隔 = 6

// 通常時: 大量の弾をばら撒くが、ほとんど曲がらない
const 通常時弾数 = 7
const 通常時威力 = 2
const 通常時展開角度 = T / 16
const 通常時角加速度 = T / 3000
const 通常時最大角速度 = T / 150

// 低速時: 少数だが鋭く曲がって一点に集中する
const 集中時弾数 = 3
const 集中時威力 = 5
const 集中時弾間隔 = 30
const 集中時角加速度 = T / 200
const 集中時最大角速度 = T / 20

// 通常時は弱くしか曲がらない弾を扇状に大量ばら撒き、低速時は少数だが鋭く曲がって
// 一点に集中する弾に切り替わる。見た目・弾数・曲がり方のすべてが大きく変わる
export const homing: MainEquipment = {
    label: "ホーミング",
    description:
        "通常時はほとんど曲がらない弾を扇状に大量ばら撒き、低速時は少数だが鋭く曲がって一点に集中する弾に切り替わる。曲がり方も弾数も大きく変わる主装備。",
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
                .damage(集中時威力)
                .speed(弾速)
                .shift(集中時弾数, 集中時弾間隔)
                .g(function* (me) {
                    yield* homingSteering(player, me, 集中時角加速度, 集中時最大角速度)
                })
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
                .damage(通常時威力)
                .speed(弾速)
                .nway(通常時弾数, 通常時展開角度)
                .g(function* (me) {
                    yield* homingSteering(player, me, 通常時角加速度, 通常時最大角速度)
                })
                .fire(player.game.bullets)
        }

        yield* Array(連射間隔)
    },
}

// 発射直後は扇状/横並びに広がった弾がそのまま見えるよう、少し待ってから追尾を始める。
// 向きを直接ターゲットに向けるのではなく、角速度を少しずつ加えて曲げていく
function* homingSteering(player: Player, me: Bullet, angularAccel: number, maxAngularVelocity: number): Generator<void, void, void> {
    yield* Array(追尾開始待機フレーム)

    let angularVelocity = 0

    for (let i = 0; i < 追尾継続フレーム; i++) {
        const target = nearestEnemy(player, me.p)

        if (target) {
            const diff = normalizeAngle(target.p.sub(me.p).radian() - me.radian)
            angularVelocity += Math.sign(diff) * angularAccel
            angularVelocity = Math.max(-maxAngularVelocity, Math.min(maxAngularVelocity, angularVelocity))
        }

        me.radian += angularVelocity
        yield
    }
}

// 自機に最も近い敵を探す。見つからなければundefined
function nearestEnemy(player: Player, from: Vec): Enemy | undefined {
    let nearest: Enemy | undefined
    let nearestDistSq = Infinity

    for (const enemy of player.game.enemies) {
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
