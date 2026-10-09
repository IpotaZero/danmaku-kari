import { Ease } from "@ipota/functions"
import { Vec, vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { Polygon } from "../BulletDrawer/Polygon"
import { Behavior, remodel } from "../Remodel"
import type { Bullet } from "../Actor/Bullet"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 大針は「一点を穿つ」装備。
// 真上へ大きな針を一本だけ飛ばし、最初に触れた敵に大きな傷を与える。
// 貫かないので、どの部位に当てるかを狙って撃つことになる。
const 針半径 = 28
const 針威力 = 100
const 初速 = 2
const 最終速度 = 36
const 加速フレーム = 20
const クールダウンフレーム = 480

const 衝撃フレーム = 36
const 衝撃半径倍率 = 10
const 破片数 = 18
const 閃光フレーム = 8
const 揺れの強さ = 16
const 揺れフレーム = 30

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
        .format("wedge")
        .r(針半径)
        .color("white")
        .alpha(0.8)
        .damage(針威力)
        .speed(初速)
        .g((me) => Behavior.accel(me, 加速フレーム, 最終速度))
        .g((me) => waitForStab(player, me))
        .fire(player.game.bullets)
}

// 針が消えるのを見張り、敵に刺さって消えたのなら刺さった所で衝撃を起こす。
// 敵に当たった針はその場で消され、そのフレームのうちにもう一度だけ動いてからこの見張りに来る。
// 画面の端で消えた針は画面の外にいるので、それと区別できる
function* waitForStab(player: Player, me: Bullet): Generator<void, void, void> {
    while (me.life > 0) yield

    const { WIDTH, HEIGHT } = player.game
    const isOnScreen = -me.r <= me.p.x && me.p.x <= WIDTH + me.r && -me.r <= me.p.y && me.p.y <= HEIGHT + me.r
    if (!isOnScreen) return

    // 当たったのは、最後に動く前の針の先端
    const direction = vec.arg(me.radian)
    const tip = me.p.add(direction.scale(me.r - me.speed))

    player.addScript(() => stab(player, tip, me.radian))
}

// 刺さった瞬間、画面が白く光って大きく揺れ、刺さった所に針の形が焼きつく。
// 針の向きと直角に光の線が画面を横切り、刺さった所から光の筋が前へ扇状に飛び散って、輪が三重に広がる。
// 弾と見間違えないよう、点や丸い粒は使わず線だけで描く
function* stab(player: Player, tip: Vec, radian: number): Generator<void, void, void> {
    const game = player.game
    game.se.hit.play()
    game.camera.shake(揺れの強さ, 揺れフレーム)

    const maxRadius = player.GRAZE_R * 衝撃半径倍率
    const forward = vec.arg(radian)
    const across = vec.arg(radian + T / 4)
    // 筋は針の向きを中心に前へ大きく開く。白い太い筋と、蜜の色の細い筋を交互に混ぜる
    const shards = Array.from({ length: 破片数 }, (_, i) => ({
        radian: radian + (i / (破片数 - 1) - 0.5) * (T / 2) + (Math.random() - 0.5) * 0.1,
        length: maxRadius * (0.5 + Math.random() * 0.8),
        color: i % 2 === 0 ? "#ffffff" : "#ecce74",
        lineWidth: i % 2 === 0 ? 4 : 2,
    }))
    // 後ろへも少しだけ跳ね返る
    const splashes = Array.from({ length: 5 }, (_, i) => ({
        radian: radian + T / 2 + (i / 4 - 0.5) * (T / 4),
        length: maxRadius * 0.35,
    }))

    for (let i = 1; i <= 衝撃フレーム; i++) {
        const progress = i / 衝撃フレーム
        const spread = Ease.Out(progress)
        const fade = 1 - progress
        // 根元が先を追いかけて、筋は伸びきるにつれて短くなる
        const tail = Ease.Out(Math.max(0, progress * 1.6 - 0.6))

        game.drawInWorld((ctx) => {
            // 画面全体の閃光
            if (i <= 閃光フレーム) {
                ctx.globalAlpha = 0.5 * (1 - i / 閃光フレーム)
                ctx.fillStyle = "#ffffff"
                // 画面の揺れで端に隙間ができないよう、少し大きめに塗る
                ctx.fillRect(-揺れの強さ, -揺れの強さ, game.WIDTH + 揺れの強さ * 2, game.HEIGHT + 揺れの強さ * 2)
            }

            // 針の向きと直角に画面を横切る光の線。太く現れ、細くなりながら消える
            ctx.globalAlpha = fade
            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 8 * fade
            const crossFrom = tip.add(across.scale(game.WIDTH * spread))
            const crossTo = tip.sub(across.scale(game.WIDTH * spread))
            ctx.beginPath()
            ctx.moveTo(crossFrom.x, crossFrom.y)
            ctx.lineTo(crossTo.x, crossTo.y)
            ctx.stroke()

            // 刺さった所に焼きついた針の形。膨らみながら薄れる
            const center = tip.sub(forward.scale(針半径))
            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 3
            ctx.beginPath()
            Polygon.vertices("wedge", 針半径 * (1 + spread)).forEach((v) => {
                const p = center.add(v.rotate(radian))
                ctx.lineTo(p.x, p.y)
            })
            ctx.closePath()
            ctx.stroke()

            // 少しずつ遅れて広がる三重の輪
            ;[0, 0.15, 0.3].forEach((delay, k) => {
                const ring = Ease.Out(Math.max(0, (progress - delay) / (1 - delay)))
                Ctx.arc(ctx, tip, maxRadius * ring * (1 - k * 0.2), k === 1 ? "#ecce74" : "#ffffffd0", {
                    lineWidth: 6 - k * 2,
                })
            })

            shards.forEach((shard) => {
                const direction = vec.arg(shard.radian)
                const from = tip.add(direction.scale(shard.length * tail))
                const to = tip.add(direction.scale(shard.length * spread))
                ctx.strokeStyle = shard.color
                ctx.lineWidth = shard.lineWidth
                ctx.beginPath()
                ctx.moveTo(from.x, from.y)
                ctx.lineTo(to.x, to.y)
                ctx.stroke()
            })

            ctx.strokeStyle = "#ffffff"
            ctx.lineWidth = 2
            splashes.forEach((splash) => {
                const direction = vec.arg(splash.radian)
                const from = tip.add(direction.scale(splash.length * tail))
                const to = tip.add(direction.scale(splash.length * spread))
                ctx.beginPath()
                ctx.moveTo(from.x, from.y)
                ctx.lineTo(to.x, to.y)
                ctx.stroke()
            })
        })

        yield
    }
}
