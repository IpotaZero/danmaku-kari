import { App } from "../App"
import { Dom } from "../Dom"
import { EquipmentId } from "../Data/Equipment"
import { playerData } from "../Data/PlayerData"
import { mainEquipments, subEquipments } from "../Game/Equipment/PlayerEquipment"
import { MapEdge, MapGraph, MapNode, MapNodeId } from "../Map/MapGraph"
import { MapMinimap } from "../Map/MapMinimap"
import { MapBee } from "../Map/MapBee"
import { MapCamera } from "../Map/MapCamera"
import { MapProps } from "../Map/MapProps"
import { InputCode } from "../utils/InputCode"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Menu, MenuOption, MenuOptionBox } from "../utils/Menu/Menu"
import { MenuPreset } from "../utils/Menu/MenuPreset"
import { Scene } from "../utils/Scene/Scene"
import { SvgFile } from "../utils/SvgFile"

type Direction = "up" | "down" | "left" | "right"

// 全体図・型の変更画面を閉じるときのフェードアウトにかける時間
const OVERLAY_FADE_OUT_MS = 200

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
}

export class SceneMap extends Scene {
    private selectedId: MapNodeId
    private readonly nodeElements = new Map<MapNodeId, HTMLElement>()
    private camera!: MapCamera
    // 地図の上の自分(蜂)。選んだノードへ飛んでいく
    private bee!: MapBee
    private livesEl!: HTMLElement
    private livesRecoveryEl!: HTMLElement
    private equipMenu?: Menu
    private equipDescriptionEl?: HTMLElement
    private minimap?: MapMinimap

    private constructor(private readonly graph: MapGraph) {
        super()
        // 前回いたノードから始める。マップの変更で消えた/未解放になったノードならスタート地点に戻す
        const saved = graph.nodes.find((node) => node.id === playerData.mapNodeId)
        this.selectedId = saved && graph.isUnlocked(saved, playerData) ? saved.id : graph.start.id
    }

    // マップと、ノードの絵柄・小物・蜂のSVGの取得を待ってから生成する
    static async create(): Promise<SceneMap> {
        const [graph] = await Promise.all([MapGraph.load(), SvgFile.loadAll()])
        return new SceneMap(graph)
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneMap: ${this.selectedId}`)

        this.root.classList.add("scene-map", "paper-scene")
        this.root.innerHTML = `
            <div class="map-seasons map-backdrop map-camera-layer"></div>
            <div class="map-grid map-backdrop map-camera-layer"></div>
            <div class="map-world map-camera-layer">
                <svg class="map-edges">
                    ${this.graph.edges.map((edge) => this.renderEdge(edge)).join("")}
                </svg>
                <div class="map-nodes"></div>
            </div>
            <div class="map-lives">
                <div class="map-lives-count"></div>
                <div class="map-lives-recovery"></div>
                <div class="map-score"></div>
            </div>
            <div class="map-controls">
                ${isSmartPhone ? "" : `<div data-control="toggle-minimap"><span class="nowrap">全体図</span>: slow(${InputCode.primaryLabel(App.settings.keyConfig.slow)})</div>`}
                <div data-control="open-equip"><span class="nowrap">型の変更</span>: action(${InputCode.primaryLabel(App.settings.keyConfig.action)})</div>
                <div data-control="back-to-title"><span class="nowrap">タイトルへ戻る</span>: cancel(${InputCode.primaryLabel(App.settings.keyConfig.cancel)})</div>
            </div>
            <div class="texture-overlay map-backdrop map-camera-layer"></div>
        `

        // スマホは全体図のボタンを置かない代わりに、ピンチで縮めて広く見渡せるようにする
        this.camera = new MapCamera(
            this.root,
            Array.from(this.root.querySelectorAll<HTMLElement>(".map-camera-layer")),
            this.graph.bounds(),
            isSmartPhone ? { min: 0.3, max: 2 } : { min: 1, max: 1 },
            () => !this.equipMenu && !this.minimap,
        )

        const nodesEl = this.root.querySelector<HTMLElement>(".map-nodes")!
        // 塊のまわりの小物は、辺より手前・ノードより奥に置く
        nodesEl.before(new MapProps(this.graph, playerData).el)
        for (const node of this.graph.nodes) {
            const el = document.createElement("div")
            // ノードには文字の代わりに、その場所の景色の絵柄を描く。まだ行けない場所の絵柄は伏せておく(css)
            el.className = `map-node scenery-${node.scenery.id}`
            el.innerHTML = `<svg class="map-node-motif" viewBox="-12 -12 24 24">${node.scenery.motif.content}</svg>`
            el.classList.toggle("locked", !this.graph.isUnlocked(node, playerData))
            // クリア済みなら銀の星、ノーミスでクリア済みなら金の星を付ける
            el.classList.toggle("cleared", playerData.isStageCleared(node.id))
            el.classList.toggle("no-miss", playerData.isStageClearedWithoutMiss(node.id))
            el.style.left = `${node.x}px`
            el.style.top = `${node.y}px`
            el.style.width = `${node.width}px`
            el.style.height = `${node.height}px`
            el.addEventListener("click", () => {
                // スワイプ・ピンチの指を離した直後に発火するclickをタップ選択として扱わない
                if (this.camera.dragged) return
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

        this.bee = new MapBee(this.graph.node(this.selectedId))
        this.root.querySelector(".map-world")!.appendChild(this.bee.el)

        this.livesEl = this.root.querySelector<HTMLElement>(".map-lives-count")!
        this.livesRecoveryEl = this.root.querySelector<HTMLElement>(".map-lives-recovery")!
        this.updateLivesDisplay()

        this.updateScoreDisplay()

        // 初期カメラは選択中ノードを中央に据えた状態から始める(アニメーションなし)
        this.camera.lookAt(this.graph.node(this.selectedId), false)
    }

    protected async onEnd(): Promise<void> {}

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
        this.bee.flyTo(this.graph.node(id))
        this.camera.lookAt(this.graph.node(id), true)
    }

    // 全ノードを一画面に収めた全体図の開閉。開いている間も方向キーでの選択移動はそのまま使える
    private toggleMinimap() {
        App.se.cursor.play()

        if (this.minimap) {
            Dom.fadeOutAndRemove(this.minimap.el, OVERLAY_FADE_OUT_MS)
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
             <div id="equip-learn" class="fadeout"></div>
             <div class="equip-description"></div>
             <div class="texture-overlay"></div>`,
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
        if (this.equipMenu) Dom.fadeOutAndRemove(this.equipMenu.container, OVERLAY_FADE_OUT_MS)
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
                    // 技は数が多く、型の変更と並べると画面からはみ出すので、選んでいる間は隠す
                    hides: ["equip-root"],
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
                    sound: "cancel",
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
                    sound: "cancel",
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
            ...Object.keys(subEquipments).map((id) => [this.buildSubEquipmentOption(id)]),
            [
                {
                    type: "select",
                    label: `戻る`,
                    onFocus: () => this.hideEquipDescription(),
                    onSelect: () => {
                        this.equipMenu?.back(1)
                    },
                    sound: "cancel",
                },
            ],
        ]
    }

    // 持っている技は選べばそのまま装備する。まだ持っていない技は、蜜を払って習得するかを尋ねる
    private buildSubEquipmentOption(id: EquipmentId): MenuOption {
        const equipment = subEquipments[id]!
        const equip = () => {
            playerData.setLoadout({ ...playerData.getLoadout(), sub: id })
            this.equipMenu?.backToRoot()
        }

        if (playerData.getOwnedSubEquipmentIds().has(id)) {
            return {
                type: "select",
                label: equipment.label,
                onFocus: () => this.showEquipDescription(equipment.description),
                onSelect: equip,
            }
        }

        return {
            type: "submenu",
            label: `${equipment.label}　<span class="equip-price">蜜 ${equipment.price.toLocaleString()}</span>`,
            hides: ["equip-sub-options"],
            disabled: () => playerData.getTotalScore() < equipment.price,
            onFocus: () => this.showEquipDescription(equipment.description),
            subMenu: () => ({
                ...MenuPreset.buildConfirmBox(
                    this.equipMenu!,
                    () => {
                        playerData.learnSubEquipment(id, equipment.price)
                        this.updateScoreDisplay()
                        equip()
                    },
                    {
                        title: "--:: 習得する? ::--",
                        elementId: "equip-learn",
                        // 題に値段まで入れるとスマホの幅からはみ出すので、払う量は「はい」の側に添える
                        confirmLabel: `はい　<span class="equip-price">蜜 ${equipment.price.toLocaleString()}</span>`,
                    },
                ),
            }),
        }
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

        // 削除した技を装備したままの保存データもある。ゲームでは技なしとして扱われる(SceneGame)ので、表示もそれに合わせる
        return subEquipments[subId]?.label ?? "なし"
    }

    // 蜜はステージで稼ぐか技の習得で払ったときにだけ変わるので、毎フレームではなくその都度表示し直す
    private updateScoreDisplay() {
        this.root.querySelector<HTMLElement>(".map-score")!.textContent =
            `蜜 ${playerData.getTotalScore().toLocaleString()}`
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

function formatMmSs(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, "0")}`
}
