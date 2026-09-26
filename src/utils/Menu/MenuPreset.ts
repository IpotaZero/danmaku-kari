import type { Menu, MenuOption, MenuOptionBox, MenuSoundPattern } from "./Menu"

export namespace MenuPreset {
    export const buildConfirmBox = (
        menu: Menu,
        onConfirm: () => void,
        {
            title = "ほんとに?",
            elementId = "yes-no",
            confirmSound,
        }: { title?: string; elementId?: string; confirmSound?: MenuSoundPattern } = {},
    ): MenuOptionBox => ({
        elementId,
        title,
        options: () => [
            [
                {
                    type: "select",
                    label: "はい",
                    sound: confirmSound,
                    onSelect: () => {
                        onConfirm()
                    },
                },
            ],
            [
                {
                    type: "select",
                    label: "いいえ",
                    sound: "cancel",
                    onSelect: () => {
                        menu.back(1)
                    },
                },
            ],
        ],
    })

    /**
     * 「はい」を holdMs だけ長押ししないと確定しない確認ダイアログ。
     * データ削除などの取り消せない操作向け。
     */
    export const buildHoldConfirmBox = (
        menu: Menu,
        onConfirm: () => void,
        {
            title = "ほんとに?",
            elementId = "yes-no",
            confirmLabel = "はい",
            confirmSound,
            holdMs = 1000,
        }: {
            title?: string
            elementId?: string
            confirmLabel?: string
            confirmSound?: MenuSoundPattern
            holdMs?: number
        } = {},
    ): MenuOptionBox => ({
        elementId,
        title,
        options: () => [
            [buildHoldOption(confirmLabel, onConfirm, { holdMs, sound: confirmSound })],
            [
                {
                    type: "select",
                    label: "いいえ",
                    sound: "cancel",
                    onSelect: () => menu.back(1),
                },
            ],
        ],
    })

    export function buildHoldOption(
        label: string,
        onConfirm: () => void,
        config: {
            holdMs: number
            sound?: MenuSoundPattern
        },
    ): MenuOption {
        const fill = document.createElement("div")
        fill.className = "hold-confirm-fill"

        const bar = document.createElement("div")
        bar.className = "hold-confirm-bar"
        bar.appendChild(fill)

        const text = document.createElement("span")
        text.textContent = label

        const wrapper = document.createElement("span")
        wrapper.className = "hold-confirm-option"
        wrapper.append(text, bar)

        return {
            type: "hold",
            label: wrapper,
            holdMs: config.holdMs,
            sound: config.sound,
            onHold: (ratio) => {
                fill.style.width = `${ratio * 100}%`
            },
            onConfirm,
        }
    }
}
