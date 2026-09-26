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
