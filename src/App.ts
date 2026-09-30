import { BgmManager } from "@ipota/bgm-manager"
import { Sound } from "./utils/Sound"
import { Dom } from "./Dom"
import { SceneChanger } from "./utils/Scene/SceneChanger"
import { Looper } from "@ipota/my-utils"
import { DigitalInput } from "@ipota/input"

Dom.init()

export namespace App {
    const context = new AudioContext()
    const master = context.createGain()
    master.connect(context.destination)

    export namespace se {
        export const graze = set("assets/se/graze.wav", 0.1)
        export const hit = set("assets/se/player_hit.mp3")
        export const dash = set("assets/se/dash.mp3")
        export const u = set("assets/se/u.mp3")

        export const crush = set("assets/se/crush.mp3")
        export const bossDefeatPre = set("assets/se/boss_defeat_pre.mp3")
        export const bossDefeat = set("assets/se/boss_defeat.mp3")
        export const charge = set("assets/se/se_charge.mp3")

        export const start = set("assets/se/mushi.mp3")
        export const uhm = set("assets/se/uhm.mp3")
        export const unlock = set("assets/se/ドアを開ける2.mp3")
        export const gameover = set("assets/se/gameover.mp3")

        function set(path: string, volume?: number) {
            return new Sound(path, context, master, { volume })
        }

        // 全SEの音量(0~1)
        export function setVolume(volume: number) {
            master.gain.value = volume
        }
    }

    export const bm = new BgmManager()

    export const sc = new SceneChanger(Dom.container)

    export const looper = new Looper(60)

    export const input = new DigitalInput({
        up: ["ArrowUp", "KeyW", "gamepad-axis-1-negative"],
        down: ["ArrowDown", "KeyS", "gamepad-axis-1-positive"],
        left: ["ArrowLeft", "KeyA", "gamepad-axis-0-negative"],
        right: ["ArrowRight", "KeyD", "gamepad-axis-0-positive"],
        slow: ["ShiftLeft"],
        suicide: ["Escape"],
        action: ["ControlLeft"],

        ok: ["Enter", "KeyZ", "Space", "gamepad-button-0"],
        cancel: ["KeyX", "Escape", "Backspace", "gamepad-button-1"],
        pause: ["Escape", "KeyP", "gamepad-button-9"],
    })
}
