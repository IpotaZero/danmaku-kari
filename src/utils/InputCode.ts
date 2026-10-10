import { SourceKey, StandardGamepadMap, type Source } from "@ipota/input"

/** DigitalInputに割り当てる入力(キーボードのe.code / ゲームパッドのボタン・軸)を扱う */
export namespace InputCode {
    export type GamepadSource = Exclude<Source, { type: "keyboard" }>

    export function isGamepad(code: Source): code is GamepadSource {
        return code.type !== "keyboard"
    }

    // 閾値の違いを無視して、同じキー/ボタン/軸かどうか。SourceKey.equalsは閾値まで比べてしまう
    export function isSameInput(a: Source, b: Source): boolean {
        return SourceKey.equals(withoutThreshold(a), withoutThreshold(b))
    }

    function withoutThreshold(code: Source): Source {
        return isGamepad(code) ? { ...code, threshold: undefined } : code
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
        return code ? StandardGamepadMap.getSourceAlias(code) : "-"
    }
}
