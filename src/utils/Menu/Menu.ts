import type { DigitalInput } from "@ipota/input"

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

export type MenuOption = MenuOption_Select | MenuOption_Submenu

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
    // このボックスが開かれた瞬間のカーソル位置。省略時は{row: 0, col: 0}
    initialCursor?: () => MenuCursor
}

/**Menuで使うアクション（DigitalInput用） */
export type ActionMenu = "ok" | "cancel" | "up" | "down" | "left" | "right"

/** 現在選択中の位置。row=何行目、col=行の中の何列目 */
export type MenuCursor = { row: number; col: number }

type MenuInput = DigitalInput.Reader<ActionMenu>

// disabledもホバーできなくてはならない。ホバーできなくすると、例えば斜違いの状況の場合、非disabledのものにホバーできなくなる。

type MenuLayer = {
    box: MenuOptionBox
    // render時に評価・固定された状態
    options: MenuOption[][]
}

// レイヤーの表示/非表示切り替えにかけるフェード時間(ms)
const TRANSITION_MS = 100

// 触れてから離すまでにこの距離(px)以上動いたら、タップではなくなぞり(ホバー)とみなす
const TAP_TOLERANCE_PX = 10

export class Menu {
    readonly container = document.createElement("div")
    private cursor: MenuCursor = { row: 0, col: 0 }

    // カーソルのスタック
    private history: MenuCursor[] = []
    // MenuOptionBoxと、評価済みのoptionsをセットで保持する
    private layerStack: MenuLayer[]
    private hidesStack: string[][] = []
    private showsStack: string[][] = []

    private optionElements: HTMLElement[][] = []
    private scrollRows: HTMLElement[] = []

    // 触れ始めの位置。指が動きすぎた(=タップではなくホバー目的のなぞり)場合や複数指の場合はundefined
    private tapStart: { x: number; y: number } | undefined

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
        this.container.addEventListener("click", (e) => this.handleContainerClick(e))
        this.container.addEventListener("mouseover", (e) => this.handleContainerHover(e))
        // タッチではmouseoverが指の移動に追従して発火しないので、touchイベントでホバー相当(指が乗っている選択肢へのカーソル移動)を扱う
        this.container.addEventListener("touchstart", (e) => this.handleContainerTouchStart(e), { passive: true })
        this.container.addEventListener("touchmove", (e) => this.handleContainerTouchMove(e), { passive: true })
        this.container.addEventListener("touchend", (e) => this.handleContainerTouchEnd(e), { passive: false })
        this.container.addEventListener("touchcancel", () => (this.tapStart = undefined), { passive: true })

        // 初期状態ではoptionsは空配列。直後のrender(true)で評価される
        this.layerStack = [{ box: this.root, options: [] }]
        this.cursor = root.initialCursor?.() ?? { row: 0, col: 0 }
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

        this.updateDisabledClasses()
    }

    // タップ/ホバー操作用。containerに1つだけ張ったリスナーからイベント委譲で呼ばれる
    private findOptionCell(target: EventTarget | null): MenuCursor | undefined {
        const optionEl = (target as HTMLElement | null)?.closest<HTMLElement>(".option")
        if (!optionEl) return undefined

        for (let r = 0; r < this.optionElements.length; r++) {
            const c = this.optionElements[r]?.indexOf(optionEl) ?? -1
            if (c !== -1) return { row: r, col: c }
        }
        return undefined
    }

    private handleContainerClick(e: MouseEvent) {
        const cell = this.findOptionCell(e.target)
        if (!cell) return

        this.moveCursorTo(cell.row, cell.col)
        this.select()
    }

    private handleContainerHover(e: MouseEvent) {
        const cell = this.findOptionCell(e.target)
        if (!cell) return

        this.moveCursorTo(cell.row, cell.col)
    }

    // touchイベントのtargetは触れ始めた要素に固定されるので、指の現在位置から選択肢を引き直す
    private findOptionCellAtTouch(touch: Touch | undefined): MenuCursor | undefined {
        if (!touch) return undefined

        return this.findOptionCell(document.elementFromPoint(touch.clientX, touch.clientY))
    }

    private hoverTouch(touch: Touch | undefined) {
        const cell = this.findOptionCellAtTouch(touch)
        if (!cell) return

        this.moveCursorTo(cell.row, cell.col)
    }

    private handleContainerTouchStart(e: TouchEvent) {
        const touch = e.touches[0]
        this.tapStart = e.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : undefined

        this.hoverTouch(touch)
    }

    private handleContainerTouchMove(e: TouchEvent) {
        const touch = e.touches[0]

        if (this.tapStart && touch) {
            const moved = Math.hypot(touch.clientX - this.tapStart.x, touch.clientY - this.tapStart.y)
            if (moved > TAP_TOLERANCE_PX) this.tapStart = undefined
        }

        this.hoverTouch(touch)
    }

    // 明確なタップ(ほとんど動かさずに離した)の場合のみ決定する。なぞって離した場合はカーソル移動だけにとどめる。
    // どちらの場合もtouchendをpreventDefaultして、後続の疑似click(二重決定)を止める
    private handleContainerTouchEnd(e: TouchEvent) {
        e.preventDefault()

        const isTap = this.tapStart !== undefined
        this.tapStart = undefined
        if (!isTap) return

        const cell = this.findOptionCellAtTouch(e.changedTouches[0])
        if (!cell) return

        this.moveCursorTo(cell.row, cell.col)
        this.select()
    }

    // 既にカーソルが乗っている場合は何もしない(選択枠再描画やonFocus再発火を防ぐ)
    private moveCursorTo(row: number, col: number) {
        if (this.cursor.row === row && this.cursor.col === col) return

        this.cursor = { row, col }
        this.updateSelectedClass()
        this.getCurrentOption()?.onFocus?.()
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

    // 要素ID -> 隠すならtrue、表示するならfalse、をまとめて切り替える。
    // 入れ替えのときに隠す要素を薄れさせていると、その間も場所を取って新しい要素を押しのけてしまうし、
    // 薄れるのを待ってから出すと切り替えがもたつく。なので入れ替えでは古い要素をすぐ消し、新しい要素だけをフェードインさせる。
    // 隠すだけのとき(サブメニューを閉じて、下に残っていた親が見えるだけのとき)は、押しのけるものがないのでフェードアウトさせる
    private applyVisibility(changes: Map<string, boolean>) {
        const hiding = [...changes].filter(([, hidden]) => hidden).map(([id]) => this.getElement(id))
        const showing = [...changes].filter(([, hidden]) => !hidden).map(([id]) => this.getElement(id))

        hiding.forEach((el) => (showing.length > 0 ? this.hideNow(el) : this.fadeOut(el)))
        showing.forEach((el) => this.fadeIn(el))
    }

    // 切り替えの途中で逆向きの切り替えが来ることがある(すばやい操作をしたとき)。
    // 予約しておいた続きが新しい切り替えを上書きしないよう、最後に望まれた状態をdatasetに覚えておき、続きの前に確かめる
    private hideNow(el: HTMLElement) {
        el.dataset.menuHidden = "true"
        el.style.transition = "none"
        el.style.opacity = "0"
        el.classList.add("fadeout")
    }

    private fadeOut(el: HTMLElement) {
        el.dataset.menuHidden = "true"
        el.style.transition = `opacity ${TRANSITION_MS}ms ease-out`
        el.style.opacity = "0"

        window.setTimeout(() => {
            if (el.dataset.menuHidden === "true") el.classList.add("fadeout")
        }, TRANSITION_MS)
    }

    private fadeIn(el: HTMLElement) {
        el.dataset.menuHidden = "false"
        el.style.transition = `opacity ${TRANSITION_MS}ms ease-out`
        el.classList.remove("fadeout")
        el.style.opacity = "0"
        // fadeoutを外した直後の同フレームでopacityを上げるとtransitionが飛ぶことがあるので次フレームにする
        requestAnimationFrame(() => {
            if (el.dataset.menuHidden === "false") el.style.opacity = "1"
        })
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
        this.applyVisibility(
            new Map([
                ...hides.map((id) => [id, true] as const),
                ...shows.map((id) => [id, false] as const),
                [subMenu.elementId, false],
            ]),
        )

        this.history.push(this.cursor)
        this.hidesStack.push(hides)
        this.showsStack.push(shows)

        this.layerStack.push({ box: subMenu, options: [] })
        this.cursor = subMenu.initialCursor?.() ?? { row: 0, col: 0 }

        this.render()
    }

    back(depth: number) {
        // 何層も戻るときは、途中の層で表示してすぐ隠すような要素があるので、最後の状態だけをまとめて切り替える
        const changes = new Map<string, boolean>()

        for (let i = 0; i < depth; i++) {
            if (this.layerStack.length <= 1) {
                this.applyVisibility(changes)
                this.onBack()
                return
            }

            const current = this.layerStack.pop()!
            changes.set(current.box.elementId, true)

            this.hidesStack.pop()!.forEach((id) => changes.set(id, false))
            this.showsStack.pop()!.forEach((id) => changes.set(id, true))

            this.cursor = this.history.pop()!
        }

        this.applyVisibility(changes)
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
