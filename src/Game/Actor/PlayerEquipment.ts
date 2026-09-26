import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { T } from "../../T"
import { EquipmentId } from "../../Data/Equipment"
import { Ctx } from "../../utils/Functions/Ctx"
import { remodel } from "../Remodel"
import type { Player } from "./Player"
import type { Enemy } from "./Enemy"

// 主装備: 攻撃の仕方に対応する
export type MainEquipment = {
    readonly label: string
    readonly description: string
    fire(player: Player): Generator<void, void, void>
}

// 副装備: action入力時の挙動に対応する
export type SubEquipment = {
    readonly label: string
    readonly description: string
    action(player: Player): Generator<void, void, void>
}

const STANDARD_FIRE_COOLDOWN = 6
const STANDARD_BULLET_SPEED = 20
const STANDARD_BULLET_R = 3

export const mainEquipments: Record<EquipmentId, MainEquipment> = {
    // 現状の攻撃の仕方(通常5way、低速時はshift撃ち)
    standard: {
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

    // 前方に細く長いビームを撃つ。自機狙いをせず一直線にしか飛ばないため、
    // 敵の正面に自機を移動させて撃ち合わせないと当たらない
    laser: {
        label: "レーザー",
        description: "前方に細く長いレーザーを撃つ。自機狙いをしないので、敵の正面に自機を移動させないと当たらない。",
        *fire(player) {
            if (!player.game.isPlaying) {
                yield
                return
            }

            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .type("friend")
                .color("white")
                .alpha(0)
                .appearance("beam")
                .collision("laser")
                .r(LASER_R)
                .length(LASER_LENGTH)
                .speed(0)
                .g(function* (me) {
                    for (let i = 0; i < LASER_ACTIVE_FRAME; i++) {
                        me.p = player.p.clone()

                        if (i < LASER_FADE_FRAME) {
                            me.alpha = LASER_ALPHA * (i / LASER_FADE_FRAME)
                        } else if (i >= LASER_ACTIVE_FRAME - LASER_FADE_FRAME) {
                            me.alpha = LASER_ALPHA * ((LASER_ACTIVE_FRAME - i) / LASER_FADE_FRAME)
                        } else {
                            me.alpha = LASER_ALPHA
                        }

                        yield
                    }

                    me.life = 0
                })
                .fire(player.game.bullets)

            yield* Array(LASER_ACTIVE_FRAME + LASER_GAP_FRAME)
        },
    },

    // ホーミングする弾を少数だけ撃つ。自動で敵に向かって曲がっていく分、5wayやレーザーに比べて弾数は絞ってある
    homing: {
        label: "ホーミング",
        description: "少数の弾が自動で最も近い敵に向かって曲がっていく。弾数は少ないが、狙いを合わせる手間が少ない。",
        *fire(player) {
            if (!player.game.isPlaying) {
                yield
                return
            }

            yield* remodel(player)
                .p(player.p.clone())
                .radian(-T / 4)
                .appearance("player")
                .type("friend")
                .color("white")
                .alpha(0.5)
                .r(HOMING_BULLET_R)
                .speed(HOMING_BULLET_SPEED)
                .nway(HOMING_BULLET_COUNT, T / 16)
                .g(function* (me) {
                    for (let i = 0; i < HOMING_TRACKING_FRAME; i++) {
                        const target = nearestEnemy(player, me.p)
                        if (target) me.radian = target.p.sub(me.p).radian()
                        yield
                    }
                })
                .fire(player.game.bullets)

            yield* Array(HOMING_FIRE_COOLDOWN)
        },
    },
}

const LASER_R = 5
const LASER_LENGTH = 900
const LASER_ACTIVE_FRAME = 36
const LASER_GAP_FRAME = 18
const LASER_FADE_FRAME = 8
const LASER_ALPHA = 0.85

const HOMING_BULLET_COUNT = 2
const HOMING_BULLET_R = 5
const HOMING_BULLET_SPEED = 12
const HOMING_TRACKING_FRAME = 50
const HOMING_FIRE_COOLDOWN = 30

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

const DASH_FRAME = 30
const DASH_COOLDOWN_FRAME = 120
const DASH_SPEED_MULTIPLIER = 5

export const subEquipments: Record<EquipmentId, SubEquipment> = {
    // actionボタンで短時間ダッシュ(その間は移動速度アップ+無敵)。クールダウン中は再発動しない
    dash: {
        label: "ダッシュ",
        description: "actionボタンで短時間ダッシュする。ダッシュ中は移動速度が上がり、無敵になる。",
        *action(player) {
            let cooldown = 0
            let burstFramesRemaining = 0

            while (true) {
                // クールタイムはダッシュ中も含め毎フレーム進める
                if (cooldown > 0) {
                    cooldown--
                    player.actionCooldownRemaining = cooldown / DASH_COOLDOWN_FRAME

                    if (cooldown === 0) {
                        player.addScript(() => actionReadyEffect(player), { id: crypto.randomUUID() })
                    }
                }

                if (burstFramesRemaining > 0) {
                    burstFramesRemaining--

                    if (burstFramesRemaining === 0) {
                        player.speedMultiplier = 1
                        player.isActionInvincible = false
                    }
                } else if (cooldown === 0 && player.game.input.isPushed("action")) {
                    cooldown = DASH_COOLDOWN_FRAME
                    burstFramesRemaining = DASH_FRAME
                    player.actionCooldownRemaining = 1
                    player.speedMultiplier = DASH_SPEED_MULTIPLIER
                    player.isActionInvincible = true
                }

                yield
            }
        },
    },

    // actionボタンで自機周囲に一定半径の弾消しバリアを展開する。クールダウン中は再発動しない
    barrier: {
        label: "バリア",
        description: "actionボタンで自機周囲に弾消しバリアを展開する。範囲内にある敵弾をスコアに変える。",
        *action(player) {
            let cooldown = 0

            while (true) {
                if (cooldown > 0) {
                    cooldown--
                    player.actionCooldownRemaining = cooldown / BARRIER_COOLDOWN_FRAME

                    if (cooldown === 0) {
                        player.addScript(() => actionReadyEffect(player), { id: crypto.randomUUID() })
                    }
                } else if (player.game.input.isPushed("action")) {
                    cooldown = BARRIER_COOLDOWN_FRAME
                    player.actionCooldownRemaining = 1
                    player.addScript(() => barrierField(player), { id: crypto.randomUUID() })
                }

                yield
            }
        },
    },
}

const BARRIER_ACTIVE_FRAME = 40
const BARRIER_COOLDOWN_FRAME = 240
const BARRIER_RADIUS_MULTIPLIER = 5

// 展開中、自機を中心とした固定半径内に入っている敵弾をスコアに変える
function* barrierField(player: Player): Generator<void, void, void> {
    const ctx = player.game.ctx
    const radius = player.GRAZE_R * BARRIER_RADIUS_MULTIPLIER

    for (let i = 1; i <= BARRIER_ACTIVE_FRAME; i++) {
        const progress = i / BARRIER_ACTIVE_FRAME
        const center = player.p

        player.game.bullets
            .filter((b) => b.type === "enemy")
            .filter((b) => b.isScorable)
            .filter((b) => b.p.sub(center).magnitude() <= radius)
            .forEach((b) => b.scorenize())

        ctx.save()
        player.game.camera.apply(ctx, player.game.WIDTH, player.game.HEIGHT)
        ctx.globalAlpha = 1 - progress * 0.5
        Ctx.arc(ctx, center, radius, "#7fdfffc0", { lineWidth: 3 })
        Ctx.arc(ctx, center, radius * 0.92, "#ffffff80", { lineWidth: 1 })
        ctx.restore()

        yield
    }
}

const ACTION_READY_EFFECT_FRAME = 45

// クールタイムが明けた瞬間に、広がるリングと"CHARGED"の文字を表示する
function* actionReadyEffect(player: Player): Generator<void, void, void> {
    const ctx = player.game.ctx

    for (let i = 1; i <= ACTION_READY_EFFECT_FRAME; i++) {
        const progress = i / ACTION_READY_EFFECT_FRAME
        const alpha = 1 - progress
        const r = Ease.Out(progress) * player.GRAZE_R * 5

        ctx.save()
        player.game.camera.apply(ctx, player.game.WIDTH, player.game.HEIGHT)
        ctx.globalAlpha = alpha

        Ctx.arc(ctx, player.p, r, "#ffffffc0", { lineWidth: 2 })
        Ctx.arc(ctx, player.p, r + player.GRAZE_R * 0.3, "#ffffffc0", { lineWidth: 2 })
        Ctx.arc(ctx, player.p, r / 2, "#ffffffc0", { lineWidth: 2 })

        const text = [..."CHARGED"]
        text.forEach((c, index) => {
            const charP = player.p.add(vec.arg(T * (index / text.length)).scale(player.GRAZE_R * 3))
            Ctx.text(ctx, charP, "#ffffff80", c, { fontFamily: "dot", fontSize: player.GRAZE_R })
        })

        ctx.restore()
        yield
    }
}
