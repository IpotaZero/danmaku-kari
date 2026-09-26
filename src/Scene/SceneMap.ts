import { input } from "../input"
import { mapGraph, MapNode, MapNodeId } from "../Map/MapGraph"
import { sc } from "../sc"
import { Scene } from "../utils/Scene/Scene"

type Direction = "up" | "down" | "left" | "right"

const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
}

export class SceneMap extends Scene {
    private selectedId: MapNodeId
    private readonly nodeElements = new Map<MapNodeId, HTMLElement>()

    constructor(selectedId: MapNodeId = mapGraph.nodes[0]!.id) {
        super()
        this.selectedId = selectedId
    }

    protected async onStart(): Promise<void> {
        this.root.classList.add("scene-map")
        this.root.innerHTML = `
            <svg class="map-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
                ${mapGraph.edges.map(([fromId, toId]) => this.renderEdge(fromId, toId)).join("")}
            </svg>
            <div class="map-nodes"></div>
        `

        const nodesEl = this.root.querySelector<HTMLElement>(".map-nodes")!
        for (const node of mapGraph.nodes) {
            const el = document.createElement("div")
            el.className = "map-node"
            el.style.left = `${node.x}%`
            el.style.top = `${node.y}%`
            el.textContent = node.label

            nodesEl.appendChild(el)
            this.nodeElements.set(node.id, el)
        }

        this.updateSelectedClass()
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
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
        } else if (input.isPushed("cancel")) {
            sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
        }
    }

    private move(direction: Direction) {
        const current = this.getNode(this.selectedId)
        const neighbors = this.getNeighborIds(current.id).map((id) => this.getNode(id))
        const next = pickClosestInDirection(current, neighbors, DIRECTION_VECTORS[direction])
        if (!next) return

        this.selectedId = next.id
        this.updateSelectedClass()
    }

    private select() {
        const node = this.getNode(this.selectedId)
        sc.goto(async () => import("./SceneGame").then(({ SceneGame }) => new SceneGame(node)))
    }

    private getNode(id: MapNodeId): MapNode {
        const node = mapGraph.nodes.find((n) => n.id === id)
        if (!node) throw new Error(`ノードが見つかりません: ${id}`)
        return node
    }

    private getNeighborIds(id: MapNodeId): MapNodeId[] {
        return mapGraph.edges.flatMap(([fromId, toId]) => {
            if (fromId === id) return [toId]
            if (toId === id) return [fromId]
            return []
        })
    }

    private updateSelectedClass() {
        this.nodeElements.forEach((el, id) => el.classList.toggle("selected", id === this.selectedId))
    }

    private renderEdge(fromId: MapNodeId, toId: MapNodeId): string {
        const from = this.getNode(fromId)
        const to = this.getNode(toId)
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`
    }
}

// 現在ノードから見て、押した方向に最も近い(角度が小さい)隣接ノードを選ぶ
function pickClosestInDirection(current: MapNode, neighbors: MapNode[], direction: { x: number; y: number }): MapNode | undefined {
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
