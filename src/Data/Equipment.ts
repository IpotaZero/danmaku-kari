// 装備システム自体は未実装。現時点では識別用の型と初期値だけ用意しておく。

export type EquipmentId = string

export type Loadout = {
    readonly main: EquipmentId
    readonly subs: readonly [EquipmentId | null, EquipmentId | null, EquipmentId | null]
}

export const DEFAULT_LOADOUT: Loadout = {
    main: "default",
    subs: [null, null, null],
}
