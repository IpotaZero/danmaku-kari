import type { Player } from "../Actor/Player"

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
    // 習得に払う花粉。初めから持っている技は0
    readonly price: number
    action(player: Player): Generator<void, void, void>
}
