import { App } from "../App"
import { playerData } from "../Data/PlayerData"
import { mainEquipments, subEquipments } from "../Game/Equipment/PlayerEquipment"
import { MapBounds, MapEdge, MapGraph, MapNode, MapNodeId } from "../Map/MapGraph"
import { MapMinimap } from "../Map/MapMinimap"
import { Menu, MenuOption, MenuOptionBox } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"

type Direction = "up" | "down" | "left" | "right"

// 説明の枠のopacity遷移(css側のtransition時間と合わせる)にかける時間
const INFO_FADE_MS = 150

// これ以上動かしたらタップではなくスワイプ(ドラッグ)とみなす閾値(px)
const DRAG_THRESHOLD = 6

// ノード選択時、そのノードが画面中央に来るまでのカメラ移動にかける時間
const CAMERA_PAN_MS = 250

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
}

type Camera = { x: number; y: number }

export class SceneMap extends Scene {
    private selectedId: MapNodeId
    private readonly nodeElements = new Map<MapNodeId, HTMLElement>()
    private mapWorldEl!: HTMLElement
    private infoEl!: HTMLElement
    private infoShowTimer?: number
    private livesEl!: HTMLElement
    private livesRecoveryEl!: HTMLElement
    private equipMenu?: Menu
    private equipDescriptionEl?: HTMLElement
    private minimap?: MapMinimap

    // ワールド座標系でのカメラ位置(=画面中央に表示されるワールド座標)
    private camera: Camera = { x: 0, y: 0 }
    private readonly worldBounds: MapBounds

    // スワイプでのカメラ操作用の状態
    private dragging = false
    private dragMoved = false
    private dragPointerId: number | null = null
    private dragStartClient: Camera = { x: 0, y: 0 }
    private dragStartCamera: Camera = { x: 0, y: 0 }
    // ドラッグ後に発火するclickをタップと誤認しないようにするためのフラグ
    private suppressNextClick = false

    private constructor(private readonly graph: MapGraph) {
        super()
        // 前回いたノードから始める。マップの変更で消えた/未解放になったノードならスタート地点に戻す
        const saved = graph.nodes.find((node) => node.id === playerData.mapNodeId)
        this.selectedId = saved && graph.isUnlocked(saved, playerData) ? saved.id : graph.start.id
        this.worldBounds = graph.bounds()
    }

    // マップの取得を待ってから生成する
    static async create(): Promise<SceneMap> {
        return new SceneMap(await MapGraph.load())
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneMap: ${this.selectedId}`)

        this.root.classList.add("scene-map")
        this.root.innerHTML = `
            <div class="map-world">
                <svg class="map-edges">
                    ${this.graph.edges.map((edge) => this.renderEdge(edge)).join("")}
                </svg>
                <div class="map-nodes"></div>
                <div class="map-node-info">
                    <div class="map-node-info-label"></div>
                </div>
            </div>
            <div class="map-lives">
                <div class="map-lives-count"></div>
                <div class="map-lives-recovery"></div>
                <div class="map-score"></div>
            </div>
            <div class="map-controls">
                <div data-control="toggle-minimap"><span class="nowrap">全体図</span>: slow(Shift)</div>
                <div data-control="open-equip"><span class="nowrap">型の変更</span>: action(Ctrl)</div>
                <div data-control="back-to-title"><span class="nowrap">タイトルへ戻る</span>: cancel(X)</div>
            </div>
            <div class="texture-overlay"></div>
        `

        this.mapWorldEl = this.root.querySelector<HTMLElement>(".map-world")!

        const nodesEl = this.root.querySelector<HTMLElement>(".map-nodes")!
        for (const node of this.graph.nodes) {
            const el = document.createElement("div")
            el.className = "map-node"
            el.classList.toggle("locked", !this.graph.isUnlocked(node, playerData))
            // クリア済みなら銀の星、ノーミスでクリア済みなら金の星を付ける
            el.classList.toggle("cleared", playerData.isStageCleared(node.id))
            el.classList.toggle("no-miss", playerData.isStageClearedWithoutMiss(node.id))
            el.style.left = `${node.x}px`
            el.style.top = `${node.y}px`
            el.style.width = `${node.width}px`
            el.style.height = `${node.height}px`
            el.addEventListener("click", () => {
                // スワイプの指を離した直後に発火するclickをタップ選択として扱わない
                if (this.suppressNextClick) {
                    this.suppressNextClick = false
                    return
                }
                this.handleNodeTap(node.id)
            })

            nodesEl.appendChild(el)
            this.nodeElements.set(node.id, el)
        }
        // 初期選択ノードにも見た目上selectedを反映しておく(そうしないと最初の移動まで枠が出ない)
        this.nodeElements.get(this.selectedId)?.classList.add("selected")

        this.root.querySelector<HTMLElement>('[data-control="back-to-title"]')?.addEventListener("click", () => {
            if (this.equipMenu) return
            App.sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
        })
        this.root.querySelector<HTMLElement>('[data-control="toggle-minimap"]')?.addEventListener("click", () => {
            if (this.equipMenu) return
            this.toggleMinimap()
        })
        this.root.querySelector<HTMLElement>('[data-control="open-equip"]')?.addEventListener("click", () => {
            if (this.equipMenu) return
            this.openEquipMenu()
        })

        this.infoEl = this.root.querySelector<HTMLElement>(".map-node-info")!

        this.livesEl = this.root.querySelector<HTMLElement>(".map-lives-count")!
        this.livesRecoveryEl = this.root.querySelector<HTMLElement>(".map-lives-recovery")!
        this.updateLivesDisplay()

        // scoreはステージ内でのみ変動する値で、SceneMap滞在中には変わらないので一度だけ表示すればよい
        this.root.querySelector<HTMLElement>(".map-score")!.textContent =
            `銭 ${playerData.getTotalScore().toLocaleString()}`

        // 初期カメラは選択中ノードを中央に据えた状態から始める(アニメーションなし)
        this.camera = this.clampCamera(this.graph.node(this.selectedId))
        this.applyCamera(false)

        // keepInfoOnScreen()が画面上の実際の位置を見て判定するため、カメラ適用後に呼ぶ
        this.showInfo()

        this.root.addEventListener("pointerdown", this.handlePointerDown)
        this.root.addEventListener("pointermove", this.handlePointerMove)
        this.root.addEventListener("pointerup", this.handlePointerUp)
        this.root.addEventListener("pointercancel", this.handlePointerUp)
    }

    protected async onEnd(): Promise<void> {
        clearTimeout(this.infoShowTimer)

        this.root.removeEventListener("pointerdown", this.handlePointerDown)
        this.root.removeEventListener("pointermove", this.handlePointerMove)
        this.root.removeEventListener("pointerup", this.handlePointerUp)
        this.root.removeEventListener("pointercancel", this.handlePointerUp)
    }

    update(): void {
        playerData.recoverLivesOverTime()
        this.updateLivesDisplay()

        if (this.equipMenu) {
            this.equipMenu.update()

            if (App.input.isPushed("action")) {
                this.closeEquipMenu()
            }

            return
        }

        if (App.input.isRepeatPushed("up", 100, 300)) {
            this.move("up")
        } else if (App.input.isRepeatPushed("down", 100, 300)) {
            this.move("down")
        } else if (App.input.isRepeatPushed("left", 100, 300)) {
            this.move("left")
        } else if (App.input.isRepeatPushed("right", 100, 300)) {
            this.move("right")
        } else if (App.input.isPushed("slow")) {
            this.toggleMinimap()
        } else if (App.input.isPushed("ok")) {
            this.select()
        } else if (App.input.isPushed("action")) {
            // 装備画面からミニマップへ行けないのに合わせ、ミニマップからも装備画面へは行けないようにする
            if (this.minimap) return
            this.openEquipMenu()
        } else if (App.input.isPushed("cancel")) {
            // ミニマップが開いていればまずそれを閉じる
            if (this.minimap) {
                this.toggleMinimap()
                return
            }
            App.sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
        }
    }

    private move(direction: Direction) {
        const current = this.graph.node(this.selectedId)
        const neighbors = this.graph.neighbors(current).filter((node) => this.graph.isUnlocked(node, playerData))

        const next = pickClosestInDirection(current, neighbors, DIRECTION_VECTORS[direction])
        if (!next) return

        this.selectNode(next.id)
    }

    private selectNode(id: MapNodeId) {
        App.se.cursor.play()

        this.selectedId = id
        playerData.moveOnMap(id)
        this.nodeElements.forEach((el, nodeId) => el.classList.toggle("selected", nodeId === this.selectedId))
        this.minimap?.select(id)
        this.hideInfo()

        this.camera = this.clampCamera(this.graph.node(id))
        this.applyCamera(true)
    }

    // 全ノードを一画面に収めた全体図の開閉。開いている間も方向キーでの選択移動はそのまま使える
    private toggleMinimap() {
        App.se.cursor.play()

        if (this.minimap) {
            this.minimap.el.remove()
            this.minimap = undefined
            return
        }

        this.minimap = new MapMinimap(
            this.graph,
            (id) => this.handleNodeTap(id),
            () => this.toggleMinimap(),
        )
        this.minimap.select(this.selectedId)
        // 左下の操作ボタンの上に被せ、全体図を開いている間は触れられないようにする
        this.root.appendChild(this.minimap.el)
    }

    // カメラをワールド座標posに向ける(=posが画面中央に来るようにする)。animateがtrueならアニメーションさせる
    private applyCamera(animate: boolean) {
        this.mapWorldEl.style.transition = animate ? `transform ${CAMERA_PAN_MS}ms ease-out` : "none"
        this.mapWorldEl.style.transform = `translate(${-this.camera.x}px, ${-this.camera.y}px)`
    }

    // カメラがノードの存在範囲より外に出ないように制限する(スワイプで無の空間へ延々と行けてしまわないため)
    private clampCamera(pos: { x: number; y: number }): Camera {
        return {
            x: clamp(pos.x, this.worldBounds.minX, this.worldBounds.maxX),
            y: clamp(pos.y, this.worldBounds.minY, this.worldBounds.maxY),
        }
    }

    private handlePointerDown = (e: PointerEvent) => {
        if (this.equipMenu) return
        if (this.minimap) return // 全体図ではカメラを動かさない
        if (this.dragging) return // 既に別の指/ボタンでドラッグ中なら無視(多点タッチでの取り違え防止)
        if (e.button !== 0) return // 左クリック/タッチのみ(右クリック等でのドラッグ開始を防ぐ)

        this.dragging = true
        this.dragMoved = false
        this.dragPointerId = e.pointerId
        this.dragStartClient = { x: e.clientX, y: e.clientY }
        this.dragStartCamera = { ...this.camera }
    }

    private handlePointerMove = (e: PointerEvent) => {
        if (!this.dragging || e.pointerId !== this.dragPointerId) return

        const dx = e.clientX - this.dragStartClient.x
        const dy = e.clientY - this.dragStartClient.y

        if (!this.dragMoved) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
            this.dragMoved = true
            this.root.classList.add("dragging")
        }

        this.camera = this.clampCamera({ x: this.dragStartCamera.x - dx, y: this.dragStartCamera.y - dy })
        this.applyCamera(false)
    }

    private handlePointerUp = (e: PointerEvent) => {
        if (!this.dragging || e.pointerId !== this.dragPointerId) return

        this.dragging = false
        this.dragPointerId = null
        this.root.classList.remove("dragging")
        // ドラッグが発生した場合、指を離した直後に発火するclickをタップ選択として扱わない
        if (this.dragMoved) this.suppressNextClick = true
    }

    // タップ操作用。既に選択中のノードをもう一度タップしたら決定(keyboardのok相当)、
    // そうでなければまずカーソルを合わせるだけ(keyboardの方向キー相当)にとどめる
    private handleNodeTap(id: MapNodeId) {
        if (this.equipMenu) return
        if (!this.graph.isUnlocked(this.graph.node(id), playerData)) return

        if (id === this.selectedId) {
            this.select()
            return
        }

        this.selectNode(id)
    }

    private select() {
        const node = this.graph.node(this.selectedId)
        if (!this.graph.isUnlocked(node, playerData)) return

        App.sc.goto(async () => import("./SceneGame").then(({ SceneGame }) => new SceneGame(node)))
    }

    // 所持している主装備・副装備の中から選び直せる、右側に開くモーダル
    private openEquipMenu() {
        this.equipMenu = new Menu(
            `<div id="equip-root"></div>
             <div id="equip-main-options" class="fadeout"></div>
             <div id="equip-sub-options" class="fadeout"></div>
             <div class="equip-description"></div>`,
            {
                elementId: "equip-root",
                title: "--:: 型の変更 ::--",
                options: () => this.buildEquipRootOptions(),
            },
            App.input,
            App.se.menu,
        )

        this.equipMenu.onBack = () => this.closeEquipMenu()
        this.equipMenu.container.classList.add("map-equip-modal")
        this.root.appendChild(this.equipMenu.container)

        this.equipDescriptionEl = this.equipMenu.container.querySelector<HTMLElement>(".equip-description")!
    }

    private closeEquipMenu() {
        this.equipMenu?.container.remove()
        this.equipMenu = undefined
        this.equipDescriptionEl = undefined
    }

    // ルート: 「主装備: ○○」「副装備: ○○」の2行。それぞれ選ぶとサブメニューが開く
    private buildEquipRootOptions(): MenuOption[][] {
        return [
            [
                {
                    type: "submenu",
                    label: `流派: ${mainEquipments[playerData.getLoadout().main]?.label ?? playerData.getLoadout().main}`,
                    hides: [],
                    onFocus: () => this.hideEquipDescription(),
                    subMenu: () => this.buildMainEquipmentSubMenu(),
                },
            ],
            [
                {
                    type: "submenu",
                    label: `技: ${this.getSubEquipmentLabel()}`,
                    hides: [],
                    onFocus: () => this.hideEquipDescription(),
                    subMenu: () => this.buildSubEquipmentSubMenu(),
                },
            ],
            [
                {
                    type: "select",
                    label: `戻る`,
                    onFocus: () => this.hideEquipDescription(),
                    onSelect: () => {
                        this.equipMenu?.back(1)
                    },
                },
            ],
        ]
    }

    private buildMainEquipmentSubMenu(): MenuOptionBox {
        return {
            elementId: "equip-main-options",
            title: "--:: 流派を選択 ::--",
            options: () => this.buildMainEquipmentOptions(),
            // 開いた瞬間、現在装備している主装備にカーソルを合わせる
            initialCursor: () => {
                const row = Object.keys(mainEquipments).indexOf(playerData.getLoadout().main)
                return { row: Math.max(row, 0), col: 0 }
            },
        }
    }

    // 所持していない主装備もdisabledとして一覧に出す(存在を知らせつつ選べないようにする)
    private buildMainEquipmentOptions(): MenuOption[][] {
        return [
            ...Object.keys(mainEquipments).map((id) => [
                {
                    type: "select" as const,
                    label: mainEquipments[id]?.label ?? id,
                    disabled: () => !playerData.getOwnedMainEquipmentIds().has(id),
                    onFocus: () => this.showEquipDescription(mainEquipments[id]?.description ?? ""),
                    onSelect: () => {
                        playerData.setLoadout({ ...playerData.getLoadout(), main: id })
                        this.equipMenu?.backToRoot()
                    },
                },
            ]),
            [
                {
                    type: "select",
                    label: `戻る`,
                    onFocus: () => this.hideEquipDescription(),
                    onSelect: () => {
                        this.equipMenu?.back(1)
                    },
                },
            ],
        ]
    }

    private buildSubEquipmentSubMenu(): MenuOptionBox {
        return {
            elementId: "equip-sub-options",
            title: "--:: 技を選択 ::--",
            options: () => this.buildSubEquipmentOptions(),
            // 開いた瞬間、現在装備している副装備にカーソルを合わせる(「なし」は先頭行)
            initialCursor: () => {
                const subId = playerData.getLoadout().sub
                const row = subId === null ? 0 : 1 + Object.keys(subEquipments).indexOf(subId)
                return { row: Math.max(row, 0), col: 0 }
            },
        }
    }

    private buildSubEquipmentOptions(): MenuOption[][] {
        return [
            [
                {
                    type: "select",
                    label: "なし",
                    onFocus: () => this.showEquipDescription("技を使用しない。"),
                    onSelect: () => {
                        playerData.setLoadout({ ...playerData.getLoadout(), sub: null })
                        this.equipMenu?.backToRoot()
                    },
                },
            ],
            ...Object.keys(subEquipments).map((id) => [
                {
                    type: "select" as const,
                    label: subEquipments[id]?.label ?? id,
                    disabled: () => !playerData.getOwnedSubEquipmentIds().has(id),
                    onFocus: () => this.showEquipDescription(subEquipments[id]?.description ?? ""),
                    onSelect: () => {
                        playerData.setLoadout({ ...playerData.getLoadout(), sub: id })
                        this.equipMenu?.backToRoot()
                    },
                },
            ]),
            [
                {
                    type: "select",
                    label: `戻る`,
                    onFocus: () => this.hideEquipDescription(),
                    onSelect: () => {
                        this.equipMenu?.back(1)
                    },
                },
            ],
        ]
    }

    // 装備選択肢にカーソルが乗っている間、その装備の説明を表示する
    private showEquipDescription(description: string) {
        if (!this.equipDescriptionEl) return
        this.equipDescriptionEl.textContent = description
        this.equipDescriptionEl.classList.toggle("visible", description.length > 0)
    }

    private hideEquipDescription() {
        this.showEquipDescription("")
    }

    private getSubEquipmentLabel(): string {
        const subId = playerData.getLoadout().sub
        if (!subId) return "なし"

        return subEquipments[subId]?.label ?? subId
    }

    // 選択移動中は説明の枠を隠し、移動が落ち着いてから改めて表示する
    private hideInfo() {
        this.infoEl.classList.remove("visible")

        clearTimeout(this.infoShowTimer)
        this.infoShowTimer = window.setTimeout(() => this.showInfo(), INFO_FADE_MS)
    }

    private showInfo() {
        const node = this.graph.node(this.selectedId)
        this.infoEl.style.left = `${node.x}px`
        // 説明の枠はノードの上端の少し上に出す
        this.infoEl.style.top = `${node.y - node.height / 2}px`
        this.infoEl.querySelector(".map-node-info-label")!.textContent = node.label
        this.infoEl.classList.add("visible")

        this.keepInfoOnScreen()
    }

    // 中央寄せ(CSSのtransform: translate(-50%, ...))のままだと、端寄りのノードや長いラベルで
    // 画面外にはみ出すことがあるため、実際の描画幅を見てその分だけ左右にずらす
    private keepInfoOnScreen() {
        const margin = 8
        this.infoEl.style.transform = ""

        const rect = this.infoEl.getBoundingClientRect()
        let shiftX = 0
        if (rect.left < margin) shiftX = margin - rect.left
        else if (rect.right > window.innerWidth - margin) shiftX = window.innerWidth - margin - rect.right

        if (shiftX !== 0) {
            this.infoEl.style.transform = `translate(calc(-50% + ${shiftX}px), calc(-100% - 0.6em))`
        }
    }

    private updateLivesDisplay() {
        this.livesEl.textContent = `残機 ${playerData.getLives()} / ${playerData.getMaxLives()}`

        const remainingMs = playerData.getLifeRecoveryRemainingMs()
        this.livesRecoveryEl.textContent = remainingMs > 0 ? `次の回復まで ${formatMmSs(remainingMs)}` : ""
    }

    private renderEdge(edge: MapEdge): string {
        const { from, to } = edge
        const locked = !this.graph.isUnlocked(from, playerData) || !this.graph.isUnlocked(to, playerData)
        const className = [locked ? "locked" : "", edge.condition.name ?? ""].join(" ")
        const line = (offset: { x: number; y: number }) =>
            `<line class="${className}" x1="${from.x + offset.x}" y1="${from.y + offset.y}" x2="${to.x + offset.x}" y2="${to.y + offset.y}" />`

        // laserの条件は二重線で表す。辺に垂直な方向へ左右にずらした2本の線を引く
        if (edge.condition.name === "laser") {
            const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
            const gap = 3
            const normal = { x: (-(to.y - from.y) / len) * gap, y: ((to.x - from.x) / len) * gap }
            return line(normal) + line({ x: -normal.x, y: -normal.y })
        }

        return line({ x: 0, y: 0 })
    }
}

// 現在ノードから見て、押した方向に最も近い(角度が小さい)隣接ノードを選ぶ
function pickClosestInDirection(
    current: MapNode,
    neighbors: MapNode[],
    direction: { x: number; y: number },
): MapNode | undefined {
    let best: MapNode | undefined
    let bestDot = -Infinity

    for (const neighbor of neighbors) {
        const dx = neighbor.x - current.x
        const dy = neighbor.y - current.y
        const len = Math.hypot(dx, dy)
        if (len === 0) continue

        const dot = (dx / len) * direction.x + (dy / len) * direction.y
        if (dot < 0.5) continue // 押した方向から60度を超えて外れているノードは候補にしない

        if (dot > bestDot) {
            bestDot = dot
            best = neighbor
        }
    }

    return best
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

function formatMmSs(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, "0")}`
}
