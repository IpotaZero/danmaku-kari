import { BgmManager } from "@ipota/bgm-manager"
import { Sound } from "./utils/Sound"
import { Dom } from "./Dom"
import { SceneChanger } from "./utils/Scene/SceneChanger"
import { Looper } from "@ipota/my-utils"
import { FrameLimiter } from "./utils/FrameLimiter"
import { FpsMeter } from "./utils/FpsMeter"
import { DigitalInput } from "@ipota/input"
import { DEFAULT_KEY_CONFIG, InputAction, Settings } from "./Data/Settings"

Dom.init()

export namespace App {
    const context = new AudioContext()
    const master = context.createGain()
    master.connect(context.destination)

    const base = `assets/se`

    export namespace se {
        export const graze = set(`${base}/graze.wav`, 0.1)
        export const hit = set(`${base}/player_hit.mp3`)
        export const dash = set(`${base}/dash.mp3`)
        export const u = set(`${base}/u.mp3`)

        export const crush = set(`${base}/crush.mp3`)
        export const bossDefeatPre = set(`${base}/boss_defeat_pre.mp3`)
        export const bossDefeat = set(`${base}/boss_defeat.mp3`)
        export const charge = set(`${base}/se_charge.mp3`)

        export const start = set(`${base}/mushi.mp3`)
        export const uhm = set(`${base}/uhm.mp3`)
        export const unlock = set(`${base}/ドアを開ける2.mp3`)
        export const gameover = set(`${base}/gameover.mp3`)

        export const ok = set(`${base}/menu/ok.mp3`)
        export const cancel = set(`${base}/menu/cancel.mp3`)
        export const cursor = set(`${base}/menu/cursor.mp3`)
        export const disabled = set(`${base}/menu/disable.mp3`)

        export const bulletSuzu = set(`${base}/bullet/鈴を鳴らす.mp3`)

        function set(path: string, volume?: number) {
            return new Sound(path, context, master, { volume })
        }

        // 全SEの音量(0~1)
        export function setVolume(volume: number) {
            master.gain.value = volume
        }

        export const menu = {
            playOk: () => ok.play(),
            playCancel: () => cancel.play(),
            playCursor: () => cursor.play(),
            playDisable: () => disabled.play(),
        }
    }

    export const bm = new BgmManager()

    export const sc = new SceneChanger(Dom.container)

    export const looper = new Looper(60)

    // 描画だけを間引く。fpsは設定(settings)で決まる
    export const drawLimiter = new FrameLimiter(60)

    // 実測fpsの表示。シーンをまたいで出し続けるので、#containerではなくbodyに置く
    export const fpsMeter = new FpsMeter()
    document.body.append(fpsMeter.element)

    export const input = new DigitalInput<InputAction>(DEFAULT_KEY_CONFIG)

    // 保存されている音量・キーコンフィグ・描画fps・fps表示を読み込んで、bm/se/input/drawLimiter/fpsMeterへ反映する
    export const settings = new Settings({ bgm: bm, se, input, drawLimiter, fpsMeter })
}
