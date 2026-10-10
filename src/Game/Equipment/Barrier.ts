import { Ease } from "@ipota/functions"
import { Ctx } from "../../utils/Functions/Ctx"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 障壁は「空間を作る」装備。
// 展開した場所に固定された結界を長く張り、入ってくる敵弾をすべてスコアに変える。
// 自機は無敵にならないので、結界の中に留まる必要がある。
// 高速移動(一瞬・頻繁・場所を移る)とは対照的に、長く・稀に・場所を作る。
const 持続フレーム = 300
const 展開フレーム = 8
const 消滅フレーム = 20
const クールダウンフレーム = 720
const 半径倍率 = 4

export const barrier: SubEquipment = {
    label: "障壁",
    description: "その場に結界を張る。中に入った敵弾を花粉に変える。",
    price: 1000,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action")) {
                player.addScript(() => barrierField(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

// 展開した瞬間の自機位置に固定される。自機が動いても結界はついてこない
function* barrierField(player: Player): Generator<void, void, void> {
    const center = player.p.clone()
    const maxRadius = player.GRAZE_R * 半径倍率

    for (let i = 1; i <= 持続フレーム; i++) {
        const radius = maxRadius * Ease.Out(Math.min(1, i / 展開フレーム))
        const remaining = 持続フレーム - i

        // 毎フレーム全弾を見るので、filterで配列を作らずに一度で振り分ける(GC対策)
        player.game.bullets.forEach((b) => {
            if (b.type !== "enemy" && b.type !== "neutral") return
            if (!b.isScorable) return
            if ((b.p.x - center.x) ** 2 + (b.p.y - center.y) ** 2 > radius ** 2) return

            b.scorenize()
        })

        player.game.drawInWorld((ctx) => {
            ctx.globalAlpha = Math.min(1, remaining / 消滅フレーム)
            Ctx.arc(ctx, center, radius, "#7fdfffc0", { lineWidth: 3 })
            // 内側の円が縮んでいき、結界の残り時間を示す
            Ctx.arc(ctx, center, radius * (remaining / 持続フレーム), "#ffffff80", { lineWidth: 1 })
        })

        yield
    }
}
