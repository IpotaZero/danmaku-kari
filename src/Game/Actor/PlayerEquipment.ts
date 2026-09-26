import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { T } from "../../T"
import { EquipmentId } from "../../Data/Equipment"
import { Ctx } from "../../utils/Functions/Ctx"
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
const DASH_COOLDOWN_FRAME = 120
const DASH_SPEED_MULTIPLIER = 5
const DASH_PARTICLES_PER_FRAME = 2

export const subEquipments: Record<EquipmentId, SubEquipment> = {
    // actionボタンで短時間ダッシュ(その間は移動速度アップ+無敵)。クールダウン中は再発動しない
    dash: {
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
                    for (let i = 0; i < DASH_PARTICLES_PER_FRAME; i++) {
                        player.addScript(() => dashParticle(player), { id: crypto.randomUUID() })
                    }

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

const DASH_PARTICLE_FRAME = 30

// ダッシュ中に自機の周りへ撒き散らす、縮小しながら消えていく三角形の粒子
function* dashParticle(player: Player): Generator<void, void, void> {
    const offset = vec((Math.random() - 0.5) * player.GRAZE_R * 8, (Math.random() - 0.5) * player.GRAZE_R * 4)
    let p = player.p.add(offset)
    let v = vec((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)

    const size = Math.random() * 2 + 3
    let angle = Math.random() * T
    const angularVelocity = (Math.random() - 0.5) * 0.1

    const ctx = player.game.ctx

    for (let i = 0; i < DASH_PARTICLE_FRAME; i++) {
        const alpha = (1 - i / DASH_PARTICLE_FRAME) * 0.35

        ctx.save()
        player.game.camera.apply(ctx, player.game.WIDTH, player.game.HEIGHT)
        ctx.globalAlpha = alpha
        Ctx.polygon(ctx, 3, 1, p, size, "#e0e0e0", { theta: angle })
        ctx.restore()

        p = p.add(v)
        v = v.scale(0.96)
        angle += angularVelocity

        yield
    }
}
