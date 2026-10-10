import { Ease } from "@ipota/functions"
import { vec } from "@ipota/vec"
import { Ctx } from "../../utils/Functions/Ctx"
import type { Player } from "../Actor/Player"
import { actionCooldown } from "./ActionCooldown"
import type { SubEquipment } from "./types"

// 一掃は「盤面を白紙に戻す」装備。
// 画面の弾をすべて花粉に変えるかわりに、次に使えるまでがとても長い。
// どの提示で切るかを選ぶことが、この技の遊びになる。
const 広がりフレーム = 40
const クールダウンフレーム = 1440

export const sweep: SubEquipment = {
    label: "一掃",
    description: "自機から波を広げ、画面の敵弾をすべて花粉に変える。",
    price: 10000,
    *action(player) {
        while (true) {
            if (player.game.input.isPushed("action")) {
                player.addScript(() => sweepWave(player))
                yield* actionCooldown(player, クールダウンフレーム)
            }

            yield
        }
    },
}

// 波は使った瞬間の自機の位置から広がり、画面のいちばん遠い角まで届く
function* sweepWave(player: Player): Generator<void, void, void> {
    const { WIDTH, HEIGHT } = player.game
    const center = player.p.clone()
    const far = Math.max(
        ...[vec(0, 0), vec(WIDTH, 0), vec(0, HEIGHT), vec(WIDTH, HEIGHT)].map((c) => c.sub(center).magnitude()),
    )

    player.game.se.crush.play()

    for (let i = 1; i <= 広がりフレーム; i++) {
        const radius = Ease.Out(i / 広がりフレーム) * far
        const alpha = 1 - i / 広がりフレーム

        // 毎フレーム全弾を見るので、filterで配列を作らずに一度で振り分ける(GC対策)
        player.game.bullets.forEach((b) => {
            if (b.type !== "enemy" && b.type !== "neutral") return
            if (!b.isScorable) return
            if ((b.p.x - center.x) ** 2 + (b.p.y - center.y) ** 2 > radius ** 2) return

            b.scorenize()
        })

        player.game.drawInWorld((ctx) => {
            ctx.globalAlpha = alpha
            Ctx.arc(ctx, center, radius, "#ecce74", { lineWidth: 6 })
            Ctx.arc(ctx, center, radius * 0.92, "#ffffffa0", { lineWidth: 2 })
        })

        yield
    }
}
