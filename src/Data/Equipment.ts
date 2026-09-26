export type EquipmentId = string

export type Loadout = {
    // 攻撃の仕方に対応する
    readonly main: EquipmentId
    // action入力時の挙動に対応する
    readonly sub: EquipmentId | null
}

export const DEFAULT_LOADOUT: Loadout = {
    main: "standard",
    sub: "dash",
}

// 初期状態で所持している装備
export const DEFAULT_OWNED_MAIN_EQUIPMENT_IDS: readonly EquipmentId[] = ["standard", "laser", "homing"]
export const DEFAULT_OWNED_SUB_EQUIPMENT_IDS: readonly EquipmentId[] = ["dash", "barrier"]
