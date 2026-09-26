import { Dom } from "./Dom"
import { SceneChanger } from "./utils/Scene/SceneChanger"

Dom.init()
export const sc = new SceneChanger(Dom.container)
