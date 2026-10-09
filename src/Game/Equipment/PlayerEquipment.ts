import { EquipmentId } from "../../Data/Equipment"
import { barrier } from "./Barrier"
import { dash } from "./Dash"
import { laser } from "./Laser"
import { needle } from "./Needle"
import { standard } from "./Standard"
import { sweep } from "./Sweep"
import type { MainEquipment, SubEquipment } from "./types"

export type { MainEquipment, SubEquipment }

export const mainEquipments: Record<EquipmentId, MainEquipment> = {
    standard,
    laser,
}

export const subEquipments: Record<EquipmentId, SubEquipment> = {
    dash,
    barrier,
    needle,
    sweep,
}
