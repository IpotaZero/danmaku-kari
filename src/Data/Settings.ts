import { SourceKey, type DigitalInput, type Source } from "@ipota/input"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"

export type InputAction = "up" | "down" | "left" | "right" | "slow" | "action" | "suicide" | "ok" | "cancel"

export type KeyConfigMap = DigitalInput.Config<InputAction>

export type VolumeKind = "bgm" | "se"

export const VOLUME_MAX_LEVEL = 10
const DEFAULT_VOLUME_LEVEL = 8

export const DEFAULT_KEY_CONFIG: KeyConfigMap = {
    up: [
        { type: "keyboard", code: "ArrowUp" },
        { type: "keyboard", code: "KeyW" },
        { type: "gamepad-axis", index: 1, direction: "negative", threshold: 0.1 },
    ],
    down: [
        { type: "keyboard", code: "ArrowDown" },
        { type: "keyboard", code: "KeyS" },
        { type: "gamepad-axis", index: 1, direction: "positive", threshold: 0.1 },
    ],
    left: [
        { type: "keyboard", code: "ArrowLeft" },
        { type: "keyboard", code: "KeyA" },
        { type: "gamepad-axis", index: 0, direction: "negative", threshold: 0.1 },
    ],
    right: [
        { type: "keyboard", code: "ArrowRight" },
        { type: "keyboard", code: "KeyD" },
        { type: "gamepad-axis", index: 0, direction: "positive", threshold: 0.1 },
    ],
    slow: [
        { type: "keyboard", code: "ShiftLeft" },
        { type: "gamepad-button", index: 2 },
    ],
    suicide: [
        { type: "keyboard", code: "Escape" },
        { type: "gamepad-button", index: 9 },
    ],
    action: [
        { type: "keyboard", code: "ControlLeft" },
        { type: "gamepad-button", index: 3 },
    ],

    ok: [
        { type: "keyboard", code: "Enter" },
        { type: "keyboard", code: "KeyZ" },
        { type: "keyboard", code: "Space" },
        { type: "gamepad-button", index: 0 },
    ],
    cancel: [
        { type: "keyboard", code: "KeyX" },
        { type: "keyboard", code: "Escape" },
        { type: "keyboard", code: "Backspace" },
        { type: "gamepad-button", index: 1 },
    ],
}

// 描画のfps。ゲームの更新は常に60fpsで、描画だけを間引く
export type DrawFps = 60 | 30

const STORAGE_KEY = "danmaku-kari.settings.v1"

type SerializedSettings = {
    volumeLevels?: Partial<Record<VolumeKind, number>>
    keyConfig?: Partial<KeyConfigMap>
    drawFps?: DrawFps
    showFps?: boolean
}

// 設定の反映先。音量はBgmManager/SEのマスター、キーコンフィグはDigitalInput、描画fpsはFrameLimiter、fps表示はFpsMeterへ渡す
type SettingsTarget = Record<VolumeKind, { setVolume(volume: number): void }> & {
    input: { updateConfig(config: KeyConfigMap): void }
    drawLimiter: { setFPS(fps: number): void }
    fpsMeter: { show(visible: boolean): void }
}

/**
 * 音量・キーコンフィグ・描画fps・fps表示など、セーブデータ(PlayerData)とは別に持つ環境設定。
 * 生成時に読み込んで反映し、変更のたびに反映してlocalStorageへ保存する。
 */
export class Settings {
    // 0~VOLUME_MAX_LEVELの段階で持つ。実際の音量は level / VOLUME_MAX_LEVEL
    readonly volumeLevels: Record<VolumeKind, number> = { bgm: DEFAULT_VOLUME_LEVEL, se: DEFAULT_VOLUME_LEVEL }

    keyConfig: KeyConfigMap = DEFAULT_KEY_CONFIG

    // スマホは描画が重くてカクつきやすいので、初期値を30fpsにする
    // やっぱなし
    drawFps: DrawFps = 60

    showFps = false

    constructor(private readonly target: SettingsTarget) {
        this.load()
        this.applyVolume("bgm")
        this.applyVolume("se")
        this.target.input.updateConfig(this.keyConfig)
        this.target.drawLimiter.setFPS(this.drawFps)
        this.target.fpsMeter.show(this.showFps)
    }

    toggleShowFps() {
        this.showFps = !this.showFps
        this.target.fpsMeter.show(this.showFps)
        this.save()
    }

    changeDrawFps(fps: DrawFps) {
        this.drawFps = fps
        this.target.drawLimiter.setFPS(this.drawFps)
        this.save()
    }

    changeVolume(kind: VolumeKind, level: number) {
        this.volumeLevels[kind] = Math.min(VOLUME_MAX_LEVEL, Math.max(0, level))
        this.applyVolume(kind)
        this.save()
    }

    // 割り当てられる数に上限は無い。既にそのアクションに割り当て済みなら何もせずfalseを返す
    addKey(action: InputAction, code: Source): boolean {
        if (this.keyConfig[action].some((c) => SourceKey.equals(c, code))) return false

        this.updateKeyConfig({ ...this.keyConfig, [action]: [...this.keyConfig[action], code] })
        return true
    }

    // どのアクションも操作できなくならないよう、最後の1つは外せない
    canRemoveKey(action: InputAction): boolean {
        return this.keyConfig[action].length > 1
    }

    removeKey(action: InputAction, code: Source) {
        if (!this.canRemoveKey(action)) return

        this.updateKeyConfig({
            ...this.keyConfig,
            [action]: this.keyConfig[action].filter((c) => !SourceKey.equals(c, code)),
        })
    }

    resetKeyConfig() {
        this.updateKeyConfig(DEFAULT_KEY_CONFIG)
    }

    private updateKeyConfig(keyConfig: KeyConfigMap) {
        this.keyConfig = keyConfig
        this.target.input.updateConfig(this.keyConfig)
        this.save()
    }

    private applyVolume(kind: VolumeKind) {
        this.target[kind].setVolume(this.volumeLevels[kind] / VOLUME_MAX_LEVEL)
    }

    private load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return

            const data: SerializedSettings = JSON.parse(raw)

            for (const kind of ["bgm", "se"] as const) {
                const level = data.volumeLevels?.[kind]
                if (typeof level === "number") this.volumeLevels[kind] = Math.min(VOLUME_MAX_LEVEL, Math.max(0, level))
            }

            if (data.drawFps === 60 || data.drawFps === 30) this.drawFps = data.drawFps
            if (typeof data.showFps === "boolean") this.showFps = data.showFps

            // 保存後にアクションが増えても、欠けているアクションはデフォルトで補う。
            // 旧形式(@ipota/inputのSourceが文字列だった頃)で保存されたアクションもデフォルトに戻す
            const keyConfig = { ...DEFAULT_KEY_CONFIG }
            for (const action of Object.keys(DEFAULT_KEY_CONFIG) as InputAction[]) {
                const sources = data.keyConfig?.[action]
                if (sources && sources.length > 0 && sources.every((c) => typeof c === "object"))
                    keyConfig[action] = sources
            }
            this.keyConfig = keyConfig
        } catch {
            // 保存データが壊れている場合は初期値のまま進める
        }
    }

    private save() {
        const data: SerializedSettings = {
            volumeLevels: this.volumeLevels,
            keyConfig: this.keyConfig,
            drawFps: this.drawFps,
            showFps: this.showFps,
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
            // 保存に失敗しても(容量超過/プライベートブラウジング等)ゲームは続行する
        }
    }
}
