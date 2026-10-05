import { playerData } from "../Data/PlayerData"
import { MapGraph, MapNode, MapNodeId } from "./MapGraph"

// ミニマップの外周に取る余白(ワールド座標px)
const MINIMAP_PADDING = 40

// 全ノードを一画面に収めて表示するオーバーレイ。
// SVGのviewBoxを全ノードの範囲に合わせ、preserveAspectRatioで画面に収める。
// まだプレイできないノードと、それにつながる辺は表示しない(先の構造をネタバレしないため)
export class MapMinimap {
    readonly el: HTMLElement
    private readonly nodeElements = new Map<MapNodeId, SVGRectElement>()
    private readonly nodes: readonly MapNode[]

    constructor(graph: MapGraph, onNodeTap: (id: MapNodeId) => void) {
        this.nodes = graph.nodes.filter((node) => graph.isUnlocked(node, playerData))
        const edges = graph.edges.filter((edge) => this.nodes.includes(edge.from) && this.nodes.includes(edge.to))

        this.el = document.createElement("div")
        this.el.className = "map-minimap"
        this.el.innerHTML = `
            <svg class="map-minimap-svg" viewBox="${this.viewBox()}" preserveAspectRatio="xMidYMid meet">
                <g class="map-minimap-edges">${edges.map((edge) => this.renderEdge(edge.from, edge.to)).join("")}</g>
                <g class="map-minimap-nodes"></g>
            </svg>
        `

        const nodesEl = this.el.querySelector<SVGGElement>(".map-minimap-nodes")!
        for (const node of this.nodes) {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
            rect.setAttribute("x", `${node.x - node.width / 2}`)
            rect.setAttribute("y", `${node.y - node.height / 2}`)
            rect.setAttribute("width", `${node.width}`)
            rect.setAttribute("height", `${node.height}`)
            rect.classList.toggle("cleared", playerData.isStageCleared(node.id))
            rect.classList.toggle("no-miss", playerData.isStageClearedWithoutMiss(node.id))
            rect.addEventListener("click", () => onNodeTap(node.id))

            nodesEl.appendChild(rect)
            this.nodeElements.set(node.id, rect)
        }
    }

    select(id: MapNodeId) {
        this.nodeElements.forEach((el, nodeId) => el.classList.toggle("selected", nodeId === id))
    }

    // 表示するノードを、その大きさも含めて囲む範囲
    private viewBox(): string {
        const nodes = this.nodes
        const minX = Math.min(...nodes.map((node) => node.x - node.width / 2)) - MINIMAP_PADDING
        const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2)) + MINIMAP_PADDING
        const minY = Math.min(...nodes.map((node) => node.y - node.height / 2)) - MINIMAP_PADDING
        const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2)) + MINIMAP_PADDING
        return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
    }

    private renderEdge(from: MapNode, to: MapNode): string {
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`
    }
}
