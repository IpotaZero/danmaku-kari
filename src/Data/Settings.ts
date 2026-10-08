import type { ConfigString, DigitalInput } from "@ipota/input"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"

export type InputAction = "up" | "down" | "left" | "right" | "slow" | "action" | "suicide" | "ok" | "cancel"

export type KeyConfigMap = DigitalInput.Config<InputAction>

export type VolumeKind = "bgm" | "se"

export const VOLUME_MAX_LEVEL = 10
const DEFAULT_VOLUME_LEVEL = 8

export const DEFAULT_KEY_CONFIG: KeyConfigMap = {
    up: ["ArrowUp", "KeyW", "gamepad-axis-1-negative"],
    down: ["ArrowDown", "KeyS", "gamepad-axis-1-positive"],
    left: ["ArrowLeft", "KeyA", "gamepad-axis-0-negative"],
    right: ["ArrowRight", "KeyD", "gamepad-axis-0-positive"],
    slow: ["ShiftLeft"],
    suicide: ["Escape"],
    action: ["ControlLeft"],

    ok: ["Enter", "KeyZ", "Space", "gamepad-button-0"],
    cancel: ["KeyX", "Escape", "Backspace", "gamepad-button-1"],
}

// 描画のfps。ゲームの更新は常に60fpsで、描画だけを間引く
export type DrawFps = 60 | 30

const STORAGE_KEY = "danmaku-kari.settings.v1"

type SerializedSettings = {
    volumeLevels?: Partial<Record<VolumeKind, number>>
    keyConfig?: Partial<KeyConfigMap>
    drawFps?: DrawFps
}

// 設定の反映先。音量はBgmManager/SEのマスター、キーコンフィグはDigitalInput、描画fpsはFrameLimiterへ渡す
type SettingsTarget = Record<VolumeKind, { setVolume(volume: number): void }> & {
    input: { updateConfig(config: KeyConfigMap): void; clear(): void }
    drawLimiter: { setFPS(fps: number): void }
}

/**
 * 音量・キーコンフィグ・描画fpsなど、セーブデータ(PlayerData)とは別に持つ環境設定。
 * 生成時に読み込んで反映し、変更のたびに反映してlocalStorageへ保存する。
 */
export class Settings {
    // 0~VOLUME_MAX_LEVELの段階で持つ。実際の音量は level / VOLUME_MAX_LEVEL
    readonly volumeLevels: Record<VolumeKind, number> = { bgm: DEFAULT_VOLUME_LEVEL, se: DEFAULT_VOLUME_LEVEL }

    keyConfig: KeyConfigMap = DEFAULT_KEY_CONFIG

    // スマホは描画が重くてカクつきやすいので、初期値を30fpsにする
    drawFps: DrawFps = isSmartPhone ? 30 : 60

    constructor(private readonly target: SettingsTarget) {
        this.load()
        this.applyVolume("bgm")
        this.applyVolume("se")
        this.target.input.updateConfig(this.keyConfig)
        this.target.drawLimiter.setFPS(this.drawFps)
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
    addKey(action: InputAction, code: ConfigString): boolean {
        if (this.keyConfig[action].includes(code)) return false

        this.updateKeyConfig({ ...this.keyConfig, [action]: [...this.keyConfig[action], code] })
        return true
    }

    // どのアクションも操作できなくならないよう、最後の1つは外せない
    canRemoveKey(action: InputAction): boolean {
        return this.keyConfig[action].length > 1
    }

    removeKey(action: InputAction, code: ConfigString) {
        if (!this.canRemoveKey(action)) return

        this.updateKeyConfig({ ...this.keyConfig, [action]: this.keyConfig[action].filter((c) => c !== code) })
    }

    resetKeyConfig() {
        this.updateKeyConfig(DEFAULT_KEY_CONFIG)
    }

    private updateKeyConfig(keyConfig: KeyConfigMap) {
        this.keyConfig = keyConfig
        this.target.input.updateConfig(this.keyConfig)
        // 外したキーを押しっぱなしにしていると、そのkeyupが無視されて押されたままの記録が残る。
        // 後でそのキーを割り当て直したときに押しっぱなし扱いにならないよう、押下状態を忘れさせる
        this.target.input.clear()
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

            // 保存後にアクションが増えても、欠けているアクションはデフォルトで補う
            this.keyConfig = { ...DEFAULT_KEY_CONFIG, ...data.keyConfig }
        } catch {
            // 保存データが壊れている場合は初期値のまま進める
        }
    }

    private save() {
        const data: SerializedSettings = {
            volumeLevels: this.volumeLevels,
            keyConfig: this.keyConfig,
            drawFps: this.drawFps,
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
            // 保存に失敗しても(容量超過/プライベートブラウジング等)ゲームは続行する
        }
    }
}
