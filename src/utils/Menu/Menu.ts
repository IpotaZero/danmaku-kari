import type { DigitalInput } from "@ipota/input"
import { holdProgress } from "./holdProgress"

export type MenuSoundPattern = "ok" | "cancel" | "none"

type BaseMenuOption = {
    label: string | HTMLElement
    /** カーソルがこの選択肢に乗った時に発火 */
    onFocus?: () => void
    /** この選択肢が有効か。毎フレーム呼ばれる */
    disabled?: () => boolean
    /** この選択肢を選択した時に鳴らす音。省略時はokを鳴らす */
    sound?: MenuSoundPattern
}

type MenuOption_Select = BaseMenuOption & {
    type: "select"
    /** この選択肢を選択した時に発火 */
    onSelect: () => void
}

type MenuOption_Submenu = BaseMenuOption & {
    type: "submenu"
    /** この選択肢を選択した時に隠す要素のid */
    hides: string[]
    /** この選択肢を選択した時に表示する要素のid。本当にこれを使わないと絶対に実装できないって場合以外は使ってはいけない。 */
    shows?: string[]
    /** この選択肢を選択した時に開くサブメニュー */
    subMenu: () => MenuOptionBox
}

type MenuOption_Hold = BaseMenuOption & {
    type: "hold"
    /** 「ok」を押し続けている割合(0〜1)を毎フレーム受け取る。離すと0に戻る */
    onHold: (ratio: number) => void
    /** holdMs経過して長押しが完了した時に発火 */
    onConfirm: () => void
    /** 確定に必要な長押し時間(ms)。*/
    holdMs: number
}

export type MenuOption = MenuOption_Select | MenuOption_Submenu | MenuOption_Hold

export type MenuOptionBox = {
    // 選択肢を表示する要素のID。
    elementId: string
    // 縦方向が行、横方向が列。1行1列だけの縦一列リストにしたい場合は [[opt1], [opt2], ...] のように各行1要素にする
    // renderのたびに再評価される (前回描画後に変化しうる内容を表示する場合に使う)
    options: () => MenuOption[][]
    // 一番上に表示
    title?: string
    // 一度に表示する最大行数。指定時、それを超える分は疑似スクロール（表示範囲の入れ替えと▲▼インジケーター）で扱う
    maxVisibleRows?: number
}

/**Menuで使うアクション（DigitalInput用） */
export type ActionMenu = "ok" | "cancel" | "up" | "down" | "left" | "right"

/** 現在選択中の位置。row=何行目、col=行の中の何列目 */
type MenuCursor = { row: number; col: number }

type MenuInput = DigitalInput.Reader<ActionMenu>

// disabledもホバーできなくてはならない。ホバーできなくすると、例えば斜違いの状況の場合、非disabledのものにホバーできなくなる。

type MenuLayer = {
    box: MenuOptionBox
    // render時に評価・固定された状態
    options: MenuOption[][]
}

type MenuHoldState = {
    option: MenuOption_Hold
    progress: Generator<number, true, void>
}

export class Menu {
    readonly container = document.createElement("div")
    private cursor: MenuCursor = { row: 0, col: 0 }
    private holdState: MenuHoldState | undefined

    // カーソルのスタック
    private history: MenuCursor[] = []
    // MenuOptionBoxと、評価済みのoptionsをセットで保持する
    private layerStack: MenuLayer[]
    private hidesStack: string[][] = []
    private showsStack: string[][] = []

    private optionElements: HTMLElement[][] = []
    private scrollRows: HTMLElement[] = []

    onBack = () => {}

    constructor(
        baseHtml: string,
        private readonly root: MenuOptionBox,
        private readonly input: MenuInput,
        private readonly se: Readonly<{
            playCursor: () => void
            playOk: () => void
            playCancel: () => void
            playDisable: () => void
        }>,
    ) {
        this.container.className = "menu"
        this.container.innerHTML = baseHtml

        // 初期状態ではoptionsは空配列。直後のrender(true)で評価される
        this.layerStack = [{ box: this.root, options: [] }]
        this.render(true)
    }

    update() {
        if (this.input.isRepeatPushed("up", 50, 500)) {
            this.se.playCursor()
            this.moveRow(-1)
        } else if (this.input.isRepeatPushed("down", 50, 500)) {
            this.se.playCursor()
            this.moveRow(1)
        } else if (this.input.isRepeatPushed("left", 50, 500)) {
            this.se.playCursor()
            this.moveCol(-1)
        } else if (this.input.isRepeatPushed("right", 50, 500)) {
            this.se.playCursor()
            this.moveCol(1)
        } else if (this.input.isPushed("ok")) {
            this.select()
        } else if (this.input.isPushed("cancel")) {
            this.se.playCancel()
            this.back(1)
        }

        this.updateHold()
        this.updateDisabledClasses()
    }

    private updateHold() {
        const option = this.getCurrentOption()

        // 現状が変化しているならアップデート
        if (option !== this.holdState?.option) {
            if (option?.type === "hold") {
                this.holdState = {
                    option,
                    progress: holdProgress(option.holdMs!, () => this.input.isPressed("ok"), {
                        disabled: option.disabled,
                        onFailed: () => {
                            this.se.playCancel()
                        },
                    }),
                }
            } else {
                this.holdState = undefined
            }
        }

        // 待ち状態じゃないなら帰る
        if (!this.holdState) return

        const { option: holdOption, progress } = this.holdState
        const result = progress.next()

        if (result.done) {
            this.holdState = undefined
            holdOption.onHold(0)
            holdOption.onConfirm()
            this.playSound(option?.sound)
        } else {
            holdOption.onHold(result.value)
        }
    }

    private playSound(sound: MenuSoundPattern | undefined) {
        switch (sound) {
            case "cancel":
                this.se.playCancel()
                break
            case "none":
                break
            default:
                this.se.playOk()
        }
    }

    private select() {
        const option = this.getCurrentOption()
        if (!option || option.disabled?.()) {
            this.se.playDisable()
            return
        }

        // 長押し確定用オプションは単押しのokでは何もしない(updateHoldが処理する)
        if (option.type === "hold") return

        this.playSound(option.sound)

        if (option.type === "select") {
            option.onSelect()
            return
        }

        this.pushSubMenu(option.subMenu(), { hides: option.hides, shows: option.shows })
    }

    private updateDisabledClasses() {
        // 関数呼び出しではなく、固定化されたoptions配列を参照する
        this.getCurrentLayer().options.forEach((row, r) => {
            row.forEach((option, c) => {
                this.optionElements[r]?.[c]?.classList.toggle("disabled", option.disabled?.() ?? false)
            })
        })
    }

    private updateSelectedClass() {
        this.container.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"))
        this.optionElements[this.cursor.row]?.[this.cursor.col]?.classList.add("selected")
    }

    private getCurrentLayer(): MenuLayer {
        return this.layerStack.at(-1)!
    }

    private getCurrentOption(): MenuOption | undefined {
        return this.getCurrentLayer().options[this.cursor.row]?.[this.cursor.col]
    }

    private getElement(elementId: string): HTMLElement {
        const el = this.container.querySelector<HTMLElement>(`#${elementId}`)
        if (!el) {
            throw new Error(`要素が見つかりません: ${elementId}`)
        }
        return el
    }

    private setHidden(elementId: string, hidden: boolean) {
        this.getElement(elementId).classList.toggle("fadeout", hidden)
    }

    // 現在のカーソル位置に選択肢が存在するか
    private isCursorValid(): boolean {
        return !!this.getCurrentLayer().options[this.cursor.row]?.[this.cursor.col]
    }

    private correctCursor() {
        let safety = 10

        while (!this.isCursorValid()) {
            this.moveCol(-1)

            safety--

            if (safety <= 0) {
                throw new Error("空行である")
            }
        }
    }

    moveRow(diff: number) {
        const layer = this.getCurrentLayer()
        const options = layer.options
        if (options.length === 0) return

        let row = (this.cursor.row + diff + options.length) % options.length

        this.cursor = { row, col: this.clampCol(row, this.cursor.col) }
        this.updateSelectedClass()
        this.updateScrollContainer(layer, this.cursor.row, this.scrollRows)
        this.getCurrentOption()?.onFocus?.()
    }

    moveCol(diff: number) {
        const row = this.getCurrentLayer().options[this.cursor.row]
        if (!row) return

        let col = (this.cursor.col + diff + row.length) % row.length

        this.cursor = { row: this.cursor.row, col }
        this.updateSelectedClass()
        this.getCurrentOption()?.onFocus?.()
    }

    private clampCol(row: number, col: number): number {
        const options = this.getCurrentLayer().options[row]
        if (!options) throw new Error()

        return Math.min(col, options.length - 1)
    }

    backToRoot() {
        this.back(this.history.length)
    }

    isRoot() {
        return this.history.length === 0
    }

    pushSubMenu(subMenu: MenuOptionBox, { hides = [], shows = [] }: { hides?: string[]; shows?: string[] } = {}) {
        hides.forEach((id) => this.setHidden(id, true))
        shows.forEach((id) => this.setHidden(id, false))

        this.history.push(this.cursor)
        this.hidesStack.push(hides)
        this.showsStack.push(shows)

        this.layerStack.push({ box: subMenu, options: [] })
        this.cursor = { row: 0, col: 0 }

        this.setHidden(subMenu.elementId, false)
        this.render()
    }

    back(depth: number) {
        for (let i = 0; i < depth; i++) {
            if (this.layerStack.length <= 1) {
                this.onBack()
                return
            }

            const current = this.layerStack.pop()!
            this.setHidden(current.box.elementId, true)

            const hides = this.hidesStack.pop()!
            hides.forEach((id) => this.setHidden(id, false))

            const shows = this.showsStack.pop()!
            shows.forEach((id) => this.setHidden(id, true))

            this.cursor = this.history.pop()!
        }

        this.render()
    }

    render(first?: boolean) {
        this.layerStack.forEach((layer, i) => {
            // renderのタイミングで内部状態（options）を固定する
            layer.options = layer.box.options()

            const isCurrent = i === this.layerStack.length - 1
            const cursorForMenu = isCurrent ? this.cursor : this.history[i]!

            this.renderMenuLayer(layer, cursorForMenu, {
                updateOptionElements: isCurrent,
            })
        })

        this.updateSelectedClass()

        if (!first) {
            this.getCurrentOption()?.onFocus?.()
        }

        this.correctCursor()
    }

    /**
     * menuStack（操作対象）に積まない、プレビュー表示用などの静的なMenuOptionBoxを描画する。
     * カーソル移動や選択操作の内部状態は更新・汚染しない。
     */
    renderPreviewBox(box: MenuOptionBox) {
        const layer: MenuLayer = {
            box,
            options: box.options(),
        }
        // updateOptionElements: false により操作用DOMのキャッシュ(optionElements/scrollRows)を上書きせずに描画する
        this.renderMenuLayer(layer, { row: 0, col: 0 }, { updateOptionElements: false })
    }

    private renderMenuLayer(
        layer: MenuLayer,
        cursor: MenuCursor,
        { updateOptionElements = false }: { updateOptionElements?: boolean } = {},
    ) {
        const boxElement = this.getElement(layer.box.elementId)
        boxElement.innerHTML = ""

        if (updateOptionElements) {
            this.optionElements = []
        }

        if (layer.box.title) {
            const title = document.createElement("span")
            title.className = "menu-title"
            title.textContent = layer.box.title
            boxElement.appendChild(title)
        }

        const scrollContainer = document.createElement("div")
        scrollContainer.className = "menu-scroll-container"
        boxElement.appendChild(scrollContainer)

        scrollContainer.appendChild(createScrollIndicator("up"))

        // 固定化された選択肢を使用する
        const allRows = layer.options
        allRows.forEach((row, r) => {
            const rowElements: HTMLElement[] = []

            const rowEl = document.createElement("div")
            rowEl.className = "option-row"

            row.forEach((option) => {
                const optionEl = createOptionElement(option)
                rowEl.appendChild(optionEl)
                rowElements.push(optionEl)
            })

            scrollContainer.appendChild(rowEl)
            if (updateOptionElements) {
                this.optionElements[r] = rowElements
            }
        })

        scrollContainer.appendChild(createScrollIndicator("down"))

        const rows = Array.from(scrollContainer.children) as HTMLElement[]
        if (updateOptionElements) {
            this.scrollRows = rows
        }

        this.updateScrollContainer(layer, cursor.row, rows)
    }

    private updateScrollContainer(layer: MenuLayer, cursorRow: number, rows: HTMLElement[]) {
        const maxVisibleRows = layer.box.maxVisibleRows
        if (!maxVisibleRows) return

        const totalRows = layer.options.length
        if (totalRows <= maxVisibleRows) return

        const scrollTop = calculateScrollTop(layer, cursorRow)

        // いったん全部隠す
        rows.forEach((row) => {
            row.classList.add("hidden")
        })

        // maxVisibleRowsだけ表示する
        rows.slice(1 + scrollTop, 1 + scrollTop + maxVisibleRows).forEach((row) => {
            row.classList.remove("hidden")
        })

        // 上のインジケータを表示すべきなら一番上に表示されている選択肢と入れ替える
        if (0 < scrollTop) {
            rows[0]?.classList.remove("hidden")
            rows[1 + scrollTop]?.classList.add("hidden")
        }

        // 下も同様
        if (scrollTop < totalRows - maxVisibleRows) {
            rows.at(-1)?.classList.remove("hidden")
            rows[scrollTop + maxVisibleRows]?.classList.add("hidden")
        }
    }
}

function visibleRowCount(layer: MenuLayer): number | undefined {
    const maxVisibleRows = layer.box.maxVisibleRows
    if (maxVisibleRows === undefined) return undefined

    const totalRows = layer.options.length
    if (totalRows <= maxVisibleRows) return undefined

    return maxVisibleRows
}

function calculateScrollTop(layer: MenuLayer, cursorRow: number): number {
    const count = visibleRowCount(layer)
    if (count === undefined) return 0

    const totalRows = layer.options.length
    const maxScrollTop = Math.max(0, totalRows - count)

    const centered = cursorRow - Math.floor((count - 1) / 2)
    return Math.min(Math.max(centered, 0), maxScrollTop)
}

function createOptionElement(option: MenuOption): HTMLElement {
    const optionEl = document.createElement("span")
    optionEl.className = "option"

    if (option.disabled?.()) {
        optionEl.classList.add("disabled")
    }

    // 矢印(::before)をラベルとは別要素にして絶対配置することで、
    // 矢印の有無でラベルの表示位置(特に中央揃え時)がずれないようにする
    const labelEl = document.createElement("span")
    labelEl.className = "option-label"

    if (option.label instanceof HTMLElement) {
        labelEl.appendChild(option.label)
    } else {
        labelEl.innerHTML = option.label
    }

    optionEl.appendChild(labelEl)

    return optionEl
}

/**
 * 疑似スクロールの▲▼インジケーターを作る。
 */
function createScrollIndicator(direction: "up" | "down"): HTMLElement {
    const el = document.createElement("div")
    el.className = `menu-scroll-indicator menu-scroll-indicator-${direction} hidden`
    el.textContent = direction === "up" ? "▲" : "▼"
    return el
}
