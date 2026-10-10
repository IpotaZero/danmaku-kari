import type { Player } from "../Actor/Player"
import { actionReadyEffect } from "./ActionReadyEffect"

// 技を使った後のクールタイム。終わるまで自機のまわりに残り時間を描かせ、明けた瞬間に知らせる。
// 技の action はこれを yield* するだけで、クールタイムを自分で数えなくてよい
export function* actionCooldown(player: Player, frame: number): Generator<void, void, void> {
    for (let i = frame; i > 0; i--) {
        player.actionCooldownRemaining = i / frame
        yield
    }

    player.actionCooldownRemaining = 0
    player.scripts.add(() => actionReadyEffect(player))
}
