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

    /**
     * codeが離されるまで待つ。キーコンフィグで押した入力が、入力を再開した瞬間に
     * ゲーム側の入力として拾われないよう、離されてから再開するために使う。
     * (ゲームパッドは押されている間ずっと押下として読めてしまい、キーボードも長押しでキーリピートが来る)
     */
    export function waitForRelease(code: ConfigString): Promise<void> {
        return new Promise((resolve) => {
            if (isGamepad(code)) {
                const poll = () => {
                    if (!isGamepadHeld(code)) {
                        resolve()
                        return
                    }
                    requestAnimationFrame(poll)
                }
                poll()
                return
            }

            const listeners = new AbortController()
            const done = () => {
                listeners.abort()
                resolve()
            }
            window.addEventListener("keyup", (e) => e.code === code && done(), { signal: listeners.signal })
            // ウィンドウの外で離されるなどしてkeyupが届かなくても、待ち続けないようにする
            window.addEventListener("blur", done, { signal: listeners.signal })
        })
    }

    // 判定はDigitalInputに合わせる(ボタンはpressed、軸は0.5を超えたら押下)
    function isGamepadHeld(code: ConfigString): boolean {
        const button = code.match(/^gamepad-button-(\d+)$/)
        const axis = code.match(/^gamepad-axis-(\d+)-(positive|negative)$/)

        return navigator.getGamepads().some((gamepad) => {
            if (!gamepad) return false
            if (button) return gamepad.buttons[Number(button[1])]?.pressed ?? false
            if (!axis) return false

            const value = gamepad.axes[Number(axis[1])] ?? 0
            return axis[2] === "positive" ? value > 0.5 : value < -0.5
        })
    }

    // 操作説明用に、割り当てのうち最初のキーボード入力の名前を返す(キーボードが無ければ最初の入力)
    export function primaryLabel(codes: readonly ConfigString[]): string {
        const code = codes.find((c) => !isGamepad(c)) ?? codes[0]
        return code ? label(code) : "-"
    }
}
