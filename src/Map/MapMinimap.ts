import { playerData } from "../Data/PlayerData"
import { MapGraph, MapNode, MapNodeId } from "./MapGraph"

// ミニマップの外周、カーソル枠のさらに外に取る余白(ワールド座標px)
const MINIMAP_PADDING = 40

// 選択中ノードを囲むカーソル枠と、ノードとの隙間(ノードの短辺に対する比率)
const CURSOR_GAP_RATIO = 0.35

// 全ノードを一画面に収めて表示するオーバーレイ。
// SVGのviewBoxを全ノードの範囲に合わせ、preserveAspectRatioで画面に収める。
// まだプレイできないノードと、まだ通れない辺は表示しない(先の構造をネタバレしないため)
export class MapMinimap {
    readonly el: HTMLElement
    private readonly nodeElements = new Map<MapNodeId, SVGRectElement>()
    // 選択中のノードを外側から囲む枠。ノードの塗り(クリア状況)を隠さずに選択を目立たせる
    private readonly cursor = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    private readonly nodes: readonly MapNode[]

    constructor(graph: MapGraph, onNodeTap: (id: MapNodeId) => void, onBack: () => void) {
        this.nodes = graph.nodes.filter((node) => graph.isUnlocked(node, playerData))
        const edges = graph.edges.filter((edge) => graph.isPassable(edge, playerData))

        this.el = document.createElement("div")
        this.el.className = "map-minimap"
        this.el.innerHTML = `
            <svg class="map-minimap-svg" viewBox="${this.viewBox()}" preserveAspectRatio="xMidYMid meet">
                <g class="map-minimap-edges">${edges.map((edge) => this.renderEdge(edge.from, edge.to)).join("")}</g>
                <g class="map-minimap-nodes"></g>
            </svg>
            <span class="map-minimap-back">戻る: cancel(X)</span>
            <div class="texture-overlay"></div>
        `
        this.el.querySelector<HTMLElement>(".map-minimap-back")!.addEventListener("click", onBack)

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

        this.cursor.classList.add("map-minimap-cursor")
        nodesEl.after(this.cursor)
    }

    select(id: MapNodeId) {
        this.nodeElements.forEach((el, nodeId) => el.classList.toggle("selected", nodeId === id))

        const node = this.nodes.find((node) => node.id === id)
        this.cursor.classList.toggle("hidden", !node)
        if (!node) return

        const rect = this.cursorRect(node)
        this.cursor.setAttribute("x", `${rect.x}`)
        this.cursor.setAttribute("y", `${rect.y}`)
        this.cursor.setAttribute("width", `${rect.width}`)
        this.cursor.setAttribute("height", `${rect.height}`)
    }

    // nodeを選んだときのカーソル枠の範囲。ノードの外側に隙間を空けて囲む
    private cursorRect(node: MapNode) {
        const gap = Math.min(node.width, node.height) * CURSOR_GAP_RATIO
        return {
            x: node.x - node.width / 2 - gap,
            y: node.y - node.height / 2 - gap,
            width: node.width + gap * 2,
            height: node.height + gap * 2,
        }
    }

    // 表示するノードを、カーソル枠まで含めて囲む範囲。端のノードを選んでも枠が見切れないようにする
    private viewBox(): string {
        const rects = this.nodes.map((node) => this.cursorRect(node))
        const minX = Math.min(...rects.map((rect) => rect.x)) - MINIMAP_PADDING
        const maxX = Math.max(...rects.map((rect) => rect.x + rect.width)) + MINIMAP_PADDING
        const minY = Math.min(...rects.map((rect) => rect.y)) - MINIMAP_PADDING
        const maxY = Math.max(...rects.map((rect) => rect.y + rect.height)) + MINIMAP_PADDING
        return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
    }

    private renderEdge(from: MapNode, to: MapNode): string {
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`
    }
}
