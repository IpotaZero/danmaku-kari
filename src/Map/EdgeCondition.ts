import { EquipmentId } from "../Data/Equipment"
import { BadgeId, PlayerData } from "../Data/PlayerData"
// MapGraphとは互いに参照し合うので、型としてだけ読み込む
import type { MapNode } from "./MapGraph"

// 辺を通ってtoが解放されるための、fromのクリアに上乗せされる条件。Canvasの辺のラベルから作る
export abstract class EdgeCondition {
    // 辺の見た目の区別(CSSクラス)に使う名前。条件がなければundefined
    abstract readonly name?: string

    abstract isMet(from: MapNode, playerData: PlayerData): boolean

    // ラベルなし: 追加の条件なし / "badges": 全免状 / それ以外: 主装備のID
    static fromLabel(label: string | undefined, badges: ReadonlySet<BadgeId>): EdgeCondition {
        if (!label) return new NoCondition()
        if (label === AllBadgesCondition.LABEL) return new AllBadgesCondition(badges)
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

// マップ上のすべての免状を持っていること
class AllBadgesCondition extends EdgeCondition {
    static readonly LABEL = "badges"
    readonly name = AllBadgesCondition.LABEL

    constructor(private readonly badges: ReadonlySet<BadgeId>) {
        super()
        // 免状を授けるノードが1つもなければ、書き忘れか書き間違いなので読み込み時点で気づけるようにする
        if (badges.size === 0) throw new Error(`辺に"${AllBadgesCondition.LABEL}"がありますが、免状を授けるノードがありません`)
    }

    isMet(_from: MapNode, playerData: PlayerData): boolean {
        return [...this.badges].every((badge) => playerData.hasBadge(badge))
    }
}