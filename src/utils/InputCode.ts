import type { Source } from "@ipota/input"

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

/** Di/** DigitalInputに割り当てる入力(キーボードのe.code / ゲームパッドのボタン・軸)を扱う */
export namespace InputCode {
    export function isGamepad(code: Source): boolean {
        return code.type !== "keyboard"
    }

    // 画面に出す短い名前。例: KeyZ -> "Z", ゲームパッドのボタン0 -> "Pad0", 軸1の負方向 -> "Axis1-"
    export function label(code: Source): string {
        switch (code.type) {
            case "keyboard":
                return SPECIAL_LABELS[code.code] ?? code.code.replace(/^(Key|Digit)/, "")
            case "gamepad-button":
                return `Pad${code.index}`
            case "gamepad-axis":
                return `Axis${code.index}${code.direction === "positive" ? "+" : "-"}`
        }
    }

    /**
     * codeが離されるまで待つ。キーコンフィグで押した入力が、入力を再開した瞬間に
     * ゲーム側の入力として拾われないよう、離されてから再開するために使う。
     * (ゲームパッドは押されている間ずっと押下として読めてしまい、キーボードも長押しでキーリピートが来る)
     */
    export function waitForRelease(code: Source): Promise<void> {
        return new Promise((resolve) => {
            if (code.type !== "keyboard") {
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
            window.addEventListener("keyup", (e) => e.code === code.code && done(), { signal: listeners.signal })
            // ウィンドウの外で離されるなどしてkeyupが届かなくても、待ち続けないようにする
            window.addEventListener("blur", done, { signal: listeners.signal })
        })
    }

    // 判定はDigitalInputに合わせる(ボタンはpressed、軸は0.5を超えたら押下)
    function isGamepadHeld(code: Exclude<Source, { type: "keyboard" }>): boolean {
        return navigator.getGamepads().some((gamepad) => {
            if (!gamepad) return false
            if (code.type === "gamepad-button") return gamepad.buttons[code.index]?.pressed ?? false

            const value = gamepad.axes[code.index] ?? 0
            return code.direction === "positive" ? value > 0.5 : value < -0.5
        })
    }

    // 操作説明用に、割り当てのうち最初のキーボード入力の名前を返す(キーボードが無ければ最初の入力)
    export function primaryLabel(codes: readonly Source[]): string {
        const code = codes.find((c) => !isGamepad(c)) ?? codes[0]
        return code ? label(code) : "-"
    }
}
