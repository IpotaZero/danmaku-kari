import { playerData } from "../Data/PlayerData"
import { mainEquipments, subEquipments } from "../Game/Actor/PlayerEquipment"
import { input } from "../input"
import { getMapNode, getNeighborIds, isMapNodeUnlocked, mapGraph, MapEdge, MapNode, MapNodeId } from "../Map/MapGraph"
import { sc } from "../sc"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"

type Direction = "up" | "down" | "left" | "right"

// 説明の枠のopacity遷移(css側のtransition時間と合わせる)にかける時間
const INFO_FADE_MS = 150

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
}

export class SceneMap extends Scene {
    private selectedId: MapNodeId
    private readonly nodeElements = new Map<MapNodeId, HTMLElement>()
    private infoEl!: HTMLElement
    private infoShowTimer?: number
    private livesEl!: HTMLElement
    private livesRecoveryEl!: HTMLElement
    private equipMenu?: Menu

    constructor(selectedId: MapNodeId = mapGraph.startId) {
        super()
        this.selectedId = selectedId
    }

    protected async onStart(): Promise<void> {
        this.root.classList.add("scene-map")
        this.root.innerHTML = `
            <svg class="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
                ${mapGraph.edges.map((edge) => this.renderEdge(edge)).join("")}
            </svg>
            <div class="map-nodes"></div>
            <div class="map-node-info">
                <div class="map-node-info-label"></div>
                <div class="map-node-info-description"></div>
            </div>
            <div class="map-lives">
                <div class="map-lives-count"></div>
                <div class="map-lives-recovery"></div>
            </div>
            <div class="texture-overlay"></div>
        `

        const nodesEl = this.root.querySelector<HTMLElement>(".map-nodes")!
        for (const node of mapGraph.nodes) {
            const el = document.createElement("div")
            el.className = "map-node"
            el.classList.toggle("locked", !isMapNodeUnlocked(node, playerData))
            el.style.left = `${node.x}%`
            el.style.top = `${node.y}%`

            nodesEl.appendChild(el)
            this.nodeElements.set(node.id, el)
        }

        this.infoEl = this.root.querySelector<HTMLElement>(".map-node-info")!
        this.showInfo()

        this.livesEl = this.root.querySelector<HTMLElement>(".map-lives-count")!
        this.livesRecoveryEl = this.root.querySelector<HTMLElement>(".map-lives-recovery")!
        this.updateLivesDisplay()
    }

    protected async onEnd(): Promise<void> {
        clearTimeout(this.infoShowTimer)
    }

    update(): void {
        playerData.recoverLivesOverTime()
        this.updateLivesDisplay()

        if (this.equipMenu) {
            this.equipMenu.update()

            if (input.isPushed("action")) {
                this.closeEquipMenu()
            }

            return
        }

        if (input.isRepeatPushed("up", 100, 300)) {
            this.move("up")
        } else if (input.isRepeatPushed("down", 100, 300)) {
            this.move("down")
        } else if (input.isRepeatPushed("left", 100, 300)) {
            this.move("left")
        } else if (input.isRepeatPushed("right", 100, 300)) {
            this.move("right")
        } else if (input.isPushed("ok")) {
            this.select()
        } else if (input.isPushed("action")) {
            this.openEquipMenu()
        } else if (input.isPushed("cancel")) {
            sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
        }
    }

    private move(direction: Direction) {
        const current = getMapNode(this.selectedId)
        const neighbors = getNeighborIds(current.id)
            .map((id) => getMapNode(id))
            .filter((node) => isMapNodeUnlocked(node, playerData))

        const next = pickClosestInDirection(current, neighbors, DIRECTION_VECTORS[direction])
        if (!next) return

        this.selectedId = next.id
        this.nodeElements.forEach((el, id) => el.classList.toggle("selected", id === this.selectedId))
        this.hideInfo()
    }

    private select() {
        const node = getMapNode(this.selectedId)
        if (!isMapNodeUnlocked(node, playerData)) return

        sc.goto(async () => import("./SceneGame").then(({ SceneGame }) => new SceneGame(node)))
    }

    // 所持している主装備・副装備の中から選び直せる、右側に開くモーダル
    private openEquipMenu() {
        this.equipMenu = new Menu(
            `<div id="equip-root"></div>
             <div id="equip-main-options" class="fadeout"></div>
             <div id="equip-sub-options" class="fadeout"></div>`,
            {
                elementId: "equip-root",
                title: "--:: 装備変更 ::--",
                options: () => [
                    [
                        {
                            type: "submenu",
                            label: `主装備: ${mainEquipments[playerData.getLoadout().main]?.label ?? playerData.getLoadout().main}`,
                            hides: ["equip-root"],
                            shows: ["equip-main-options"],
                            subMenu: () => ({
                                elementId: "equip-main-options",
                                title: "--:: 主装備を選択 ::--",
                                options: () =>
                                    [...playerData.getOwnedMainEquipmentIds()].map((id) => [
                                        {
                                            type: "select",
                                            label: mainEquipments[id]?.label ?? id,
                                            onSelect: () => {
                                                playerData.setLoadout({ ...playerData.getLoadout(), main: id })
                                                this.equipMenu?.backToRoot()
                                            },
                                        },
                                    ]),
                            }),
                        },
                    ],
                    [
                        {
                            type: "submenu",
                            label: `副装備: ${this.getSubEquipmentLabel()}`,
                            hides: ["equip-root"],
                            shows: ["equip-sub-options"],
                            subMenu: () => ({
                                elementId: "equip-sub-options",
                                title: "--:: 副装備を選択 ::--",
                                options: () => [
                                    [
                                        {
                                            type: "select" as const,
                                            label: "なし",
                                            onSelect: () => {
                                                playerData.setLoadout({ ...playerData.getLoadout(), sub: null })
                                                this.equipMenu?.backToRoot()
                                            },
                                        },
                                    ],
                                    ...[...playerData.getOwnedSubEquipmentIds()].map((id) => [
                                        {
                                            type: "select" as const,
                                            label: subEquipments[id]?.label ?? id,
                                            onSelect: () => {
                                                playerData.setLoadout({ ...playerData.getLoadout(), sub: id })
                                                this.equipMenu?.backToRoot()
                                            },
                                        },
                                    ]),
                                ],
                            }),
                        },
                    ],
                ],
            },
            input,
            {
                playCursor: () => {},
                playOk: () => {},
                playCancel: () => {},
                playDisable: () => {},
            },
        )

        this.equipMenu.onBack = () => this.closeEquipMenu()
        this.equipMenu.container.classList.add("map-equip-modal")
        this.root.appendChild(this.equipMenu.container)
    }

    private closeEquipMenu() {
        this.equipMenu?.container.remove()
        this.equipMenu = undefined
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
        const node = getMapNode(this.selectedId)
        this.infoEl.style.left = `${node.x}%`
        this.infoEl.style.top = `${node.y}%`
        this.infoEl.querySelector(".map-node-info-label")!.textContent = node.label
        this.infoEl.querySelector(".map-node-info-description")!.textContent = node.description
        this.infoEl.classList.add("visible")
    }

    private updateLivesDisplay() {
        this.livesEl.textContent = `残機 ${playerData.getLives()} / ${playerData.getMaxLives()}`

        const remainingMs = playerData.getLifeRecoveryRemainingMs()
        this.livesRecoveryEl.textContent = remainingMs > 0 ? `次の回復まで ${formatMmSs(remainingMs)}` : ""
    }

    private renderEdge(edge: MapEdge): string {
        const from = getMapNode(edge.from)
        const to = getMapNode(edge.to)
        const locked = !isMapNodeUnlocked(from, playerData) || !isMapNodeUnlocked(to, playerData)
        return `<line class="${locked ? "locked" : ""}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`
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
