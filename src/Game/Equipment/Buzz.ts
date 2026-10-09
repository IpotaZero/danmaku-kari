import { Ease } from "@ipota/functions"
import { Ctx } from "../../utils/Functions/Ctx"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 羽音は「隙間をこじ開ける」装備。
// 激しく羽ばたいて、まわりの敵弾を外へ押しのける。弾は消えずに押しのけた先で詰まるので、
// 開けた隙間に留まるのか、詰まった壁の向こうへ抜けるのかを考えることになる。
const 押しのけフレーム = 24
const 押しのけ速度 = 10
const 半径倍率 = 8
const クールダウンフレーム = 480

export const buzz: SubEquipment = {
    label: "羽音",
    description: "激しく羽ばたき、まわりの敵弾を外へ押しのける。弾は消えない。",
    price: 7500,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action")) {
                player.addScript(() => wingbeat(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

// 羽ばたきは自機についてくる。押す強さは始めがいちばん強く、だんだん弱まる
function* wingbeat(player: Player): Generator<void, void, void> {
    const radius = player.GRAZE_R * 半径倍率

    player.game.se.dash.play()

    for (let i = 1; i <= 押しのけフレーム; i++) {
        const progress = i / 押しのけフレーム
        const push = 押しのけ速度 * (1 - progress)
        const center = player.p.clone()

        player.game.bullets
            .filter((b) => b.type === "enemy" || b.type === "neutral")
            .filter((b) => b.isScorable)
            .forEach((b) => {
                const away = b.p.sub(center)
                const distance = away.magnitude()
                if (distance === 0 || distance > radius) return

                b.p = b.p.add(away.scale(push / distance))
            })

        player.game.drawInWorld((ctx) => {
            ctx.globalAlpha = 1 - progress
            Ctx.arc(ctx, center, radius * Ease.Out(progress), "#ffffffc0", { lineWidth: 2 })
            Ctx.arc(ctx, center, radius * Ease.Out(progress) * 0.7, "#ffffff80", { lineWidth: 1 })
            Ctx.arc(ctx, center, radius, "#ffffff40", { lineWidth: 1 })
        })

        yield
    }
}
