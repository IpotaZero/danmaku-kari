import type { ConfigString } from "@ipota/input"

// e.codeのままだと長い/分かりにくいものだけ、表示用の名前を決めておく
const SPECIAL_LABELS: Partial<Record<string, string>> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "LShift",
    ShiftRight: "RShift",
    ControlLeft: "LCtrl",
    ControlRight: "RCtrl",
    AltLeft: "LAlt",
    AltRight: "RAlt",
    Escape: "Esc",
    Backspace: "BS",
}

/** DigitalInputに割り当てる入力(キーボードのe.code / ゲームパッドのボタン・軸)を扱う */
export namespace InputCode {
    export function isGamepad(code: ConfigString): boolean {
        return code.startsWith("gamepad-")
    }

    // 画面に出す短い名前。例: "KeyZ" -> "Z", "gamepad-button-0" -> "Pad0", "gamepad-axis-1-negative" -> "Axis1-"
    export function label(code: ConfigString): string {
        const special = SPECIAL_LABELS[code]
        if (special) return special

        const button = code.match(/^gamepad-button-(\d+)$/)
        if (button) return `Pad${button[1]}`

        const axis = code.match(/^gamepad-axis-(\d+)-(positive|negative)$/)
        if (axis) return `Axis${axis[1]}${axis[2] === "positive" ? "+" : "-"}`

        return code.replace(/^(Key|Digit)/, "")
    }

    // 操作説明用に、割り当てのうち最初のキーボード入力の名前を返す(キーボードが無ければ最初の入力)
    export function primaryLabel(codes: readonly ConfigString[]): string {
        const code = codes.find((c) => !isGamepad(c)) ?? codes[0]
        return code ? label(code) : "-"
    }
}
