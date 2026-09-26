import { EquipmentId } from "../../Data/Equipment"
import { barrier } from "./Equipment/Barrier"
import { dash } from "./Equipment/Dash"
import { homing } from "./Equipment/Homing"
import { laser } from "./Equipment/Laser"
import { standard } from "./Equipment/Standard"
import type { MainEquipment, SubEquipment } from "./Equipment/types"

export type { MainEquipment, SubEquipment }

export const mainEquipments: Record<EquipmentId, MainEquipment> = {
    standard,
    laser,
    homing,
}

export const subEquipments: Record<EquipmentId, SubEquipment> = {
    dash,
    barrier,
}
