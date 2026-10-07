import { ConfigString, KeyConfig } from "@ipota/input"
import { App } from "../App"
import { playerData } from "../Data/PlayerData"
import { InputAction, VOLUME_MAX_LEVEL, VolumeKind } from "../Data/Settings"
import { InputCode } from "../utils/InputCode"
import type { Menu, MenuOption, MenuOptionBox } from "../utils/Menu/Menu"
import { MenuPreset } from "../utils/Menu/MenuPreset"

const VOLUME_LABELS: Record<VolumeKind, string> = {
    bgm: "BGM",
    se: "SE",
}

// キーコンフィグに並べる順もこの順にする
const ACTION_LABELS: Record<InputAction, string> = {
    up: "上",
    down: "下",
    left: "左",
    right: "右",
    slow: "低速",
    action: "技",
    suicide: "自爆",
    ok: "決定",
    cancel: "キャンセル",
}

/**
 * 音量・キーコンフィグ・セーブデータの削除をまとめた設定メニュー。
 * 呼び出し側のMenuのサブメニューとして開く。MenuのbaseHtmlには SettingsMenu.HTML を含めておくこと。
 */
export class SettingsMenu {
    static readonly HTML = `
        <div id="settings" class="settings-panel fadeout"></div>
        <div id="settings-keyconfig" class="settings-panel fadeout"></div>
        <div id="settings-keybind" class="settings-panel fadeout"></div>
        <div id="settings-delete" class="settings-panel fadeout"></div>
    `

    // キーの追加で入力を待っている間だけ存在する。abortすると待つのをやめる
    private waiting?: AbortController

    constructor(private readonly menu: Menu) {}

    box(): MenuOptionBox {
        return {
            elementId: "settings",
            title: "設定",
            options: () => [
                this.volumeRow("bgm"),
                this.volumeRow("se"),
                [
                    {
                        type: "submenu",
                        label: "キーコンフィグ",
                        hides: ["settings"],
                        subMenu: () => this.keyConfigBox(),
                    },
                ],
                [
                    {
                        type: "submenu",
                        label: "データの削除",
                        hides: ["settings"],
                        subMenu: () => this.deleteDataBox(),
                    },
                ],
                [
                    {
                        type: "select",
                        label: "戻る",
                        sound: "cancel",
                        onSelect: () => this.menu.back(1),
                    },
                ],
            ],
        }
    }

    // [←] [名前とゲージ] [→] の3列。左右の矢印を選ぶと1段階ずつ変わる
    private volumeRow(kind: VolumeKind): MenuOption[] {
        return [
            this.volumeArrow(kind, -1),
            {
                type: "select",
                label: this.volumeLabel(kind),
                // 名前とゲージを見せるだけで、選んでも何もしない
                sound: "none",
                onSelect: () => {},
            },
            this.volumeArrow(kind, 1),
        ]
    }

    private volumeArrow(kind: VolumeKind, diff: -1 | 1): MenuOption {
        const label = document.createElement("span")
        label.className = "settings-arrow"
        label.textContent = diff < 0 ? "←" : "→"

        return {
            type: "select",
            label,
            // 変更後の音量で鳴らしたいので、Menuには鳴らさせず変更してから自前で鳴らす
            sound: "none",
            // これ以上変えられない側の矢印は選べないようにする
            disabled: () => {
                const next = App.settings.volumeLevels[kind] + diff
                return next < 0 || VOLUME_MAX_LEVEL < next
            },
            onSelect: () => {
                App.settings.changeVolume(kind, App.settings.volumeLevels[kind] + diff)
                App.se.menu.playOk()
                this.menu.render()
            },
        }
    }

    private volumeLabel(kind: VolumeKind): HTMLElement {
        const level = App.settings.volumeLevels[kind]

        const el = document.createElement("span")
        el.className = "settings-row"
        el.innerHTML = `
            <span>${VOLUME_LABELS[kind]}</span>
            <span class="settings-gauge">${"■".repeat(level)}${"□".repeat(VOLUME_MAX_LEVEL - level)}</span>
        `
        return el
    }

    // アクションの一覧。選ぶとそのアクションのキーを追加・削除するサブメニューが開く
    private keyConfigBox(): MenuOptionBox {
        const actions = Object.keys(ACTION_LABELS) as InputAction[]

        return {
            elementId: "settings-keyconfig",
            title: "キーコンフィグ",
            options: () => [
                ...actions.map((action): MenuOption[] => [
                    {
                        type: "submenu",
                        label: this.keyConfigLabel(action),
                        hides: ["settings-keyconfig"],
                        subMenu: () => this.keyBindBox(action),
                    },
                ]),
                [
                    {
                        type: "select",
                        label: "初期設定に戻す",
                        onSelect: () => {
                            App.settings.resetKeyConfig()
                            this.menu.render()
                        },
                    },
                ],
                [
                    {
                        type: "select",
                        label: "戻る",
                        sound: "cancel",
                        onSelect: () => this.menu.back(1),
                    },
                ],
            ],
        }
    }

    private keyConfigLabel(action: InputAction): HTMLElement {
        const keys = App.settings.keyConfig[action].map((code) => InputCode.label(code)).join(" ")

        const el = document.createElement("span")
        el.className = "settings-row"
        el.innerHTML = `
            <span>${ACTION_LABELS[action]}</span>
            <span class="settings-keys">${keys}</span>
        `
        return el
    }

    // 1つのアクションに割り当てたキーの一覧。「追加」で好きなだけ増やせ、キーを選ぶとそのキーを外す。
    // 追加を先頭に置くのは、追加したキーが下に増えてもカーソルが追加の上に残るようにするため
    private keyBindBox(action: InputAction): MenuOptionBox {
        return {
            elementId: "settings-keybind",
            title: ACTION_LABELS[action],
            options: () => [
                [
                    {
                        type: "select",
                        label: this.waiting ? "キーを押してください" : "＋ 追加",
                        onSelect: () => {
                            this.toggleWaiting(action)
                        },
                    },
                ],
                ...App.settings.keyConfig[action].map((code): MenuOption[] => [
                    {
                        type: "select",
                        label: this.keyBindLabel(code),
                        sound: "cancel",
                        // 入力待ちの間は追加以外を選べないようにする
                        disabled: () => this.waiting !== undefined || !App.settings.canRemoveKey(action),
                        onSelect: () => {
                            App.settings.removeKey(action, code)
                            this.menu.render()
                        },
                    },
                ]),
                [
                    {
                        type: "select",
                        label: "戻る",
                        sound: "cancel",
                        disabled: () => this.waiting !== undefined,
                        onSelect: () => this.menu.back(1),
                    },
                ],
            ],
        }
    }

    private keyBindLabel(code: ConfigString): HTMLElement {
        const el = document.createElement("span")
        el.className = "settings-row"
        el.innerHTML = `
            <span>${InputCode.label(code)}</span>
            <span>×</span>
        `
        return el
    }

    // 入力待ちでなければ待ち始め、入力待ち中にもう一度選ばれたら(クリックなど)中止する
    private toggleWaiting(action: InputAction) {
        if (this.waiting) {
            this.waiting.abort()
            return
        }

        this.waitAndAddKey(action)
    }

    private async waitAndAddKey(action: InputAction) {
        const waiting = new AbortController()
        this.waiting = waiting

        // 割り当てたいキーを押したときに、メニューが動いたり決定されたりしないようにする
        App.input.pause("keyconfig")
        this.menu.render()

        try {
            const code = await KeyConfig.waitForAnyInput({ signal: waiting.signal })

            // 既に割り当て済みのキーを押した場合は何も変わらないので、中止したのと同じ扱いにする
            if (App.settings.addKey(action, code)) {
                App.se.menu.playOk()
            } else {
                App.se.menu.playCancel()
            }
        } catch {
            // 中止された(waitForAnyInputはabort以外でrejectしない)
            App.se.menu.playCancel()
        } finally {
            this.waiting = undefined
            App.input.resume("keyconfig")
            this.menu.render()
        }
    }

    private deleteDataBox(): MenuOptionBox {
        return {
            ...MenuPreset.buildConfirmBox(
                this.menu,
                () => {
                    playerData.reset()
                    this.menu.back(1)
                },
                { title: "セーブデータを消す?", elementId: "settings-delete" },
            ),
            // うっかり消してしまわないよう、最初は「いいえ」に合わせておく
            initialCursor: () => ({ row: 1, col: 0 }),
        }
    }
}
