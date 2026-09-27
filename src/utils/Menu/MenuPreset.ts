import type { Menu, MenuOptionBox, MenuSoundPattern } from "./Menu"

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
}
