import type { Player } from "../Player"

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
