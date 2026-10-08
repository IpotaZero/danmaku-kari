import { EquipmentId } from "../Data/Equipment"
import { PlayerData } from "../Data/PlayerData"
// MapGraphとは互いに参照し合うので、型としてだけ読み込む
import type { MapNode } from "./MapGraph"

// 辺を通ってtoが解放されるための、fromのクリアに上乗せされる条件。Canvasの辺のラベルから作る
export abstract class EdgeCondition {
    // 辺の見た目の区別(CSSクラス)に使う名前。条件がなければundefined
    abstract readonly name?: string

    abstract isMet(from: MapNode, playerData: PlayerData): boolean

    // ラベルなし: 追加の条件なし / それ以外: 主装備のID
    static fromLabel(label: string | undefined): EdgeCondition {
        if (!label) return new NoCondition()
        return new MainEquipmentCondition(label)
    }
}

class NoCondition extends EdgeCondition {
    readonly name = undefined

    isMet(): boolean {
        return true
    }
}

// fromをこの主装備でクリアしていること
class MainEquipmentCondition extends EdgeCondition {
    constructor(readonly name: EquipmentId) {
        super()
    }

    isMet(from: MapNode, playerData: PlayerData): boolean {
        return playerData.getStageClearedMainEquipments(from.id).has(this.name)
    }
}
