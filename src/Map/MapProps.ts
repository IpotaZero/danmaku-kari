import { PlayerData } from "../Data/PlayerData"
import { seededRandom } from "../utils/Functions/seededRandom"
import type { MapGraph, MapNode } from "./MapGraph"

// 置いた小物の位置と大きさ(半径)。ほかの小物と重ならないように覚えておく
type Placed = { readonly x: number; readonly y: number; readonly r: number }

// 塊の上側の帯は、選んだノードの上にとまる蜂(MapBee)の背丈ぶん離して始める
const ABOVE_GAP = 70
// 塊の下側の帯は、ノードのすぐ下から始める
const BELOW_GAP = 22
// 帯の厚さ
const BAND = 80
// 小物の大きさの倍率。小物ごとの大きさ(Prop.size)はそのままの比で、全体をこれだけ大きくする
const PROP_SCALE = 1.5

// 地図の塊(同じ景色のノードのまとまり)のまわりに、その場所を特徴づける小物(Prop)を置く。
// 小物は塊の上下の帯に、ノード・辺・ほかの小物と重ならないように散らす。
// 並びは塊ごとに決まった乱数で決めるので、地図を開くたびに同じ所にある。
// まだどのノードにも行けない塊の小物は伏せておき、たどり着いたときに初めて見えるようにする
export class MapProps {
    readonly el = document.createElement("div")

    private readonly placed: Placed[] = []

    constructor(
        private readonly graph: MapGraph,
        playerData: PlayerData,
    ) {
        this.el.className = "map-props"

        for (const cluster of graph.clusters()) {
            const group = document.createElement("div")
            group.className = "map-props-cluster"
            group.classList.toggle(
                "locked",
                cluster.every((node) => !graph.isUnlocked(node, playerData)),
            )
            this.scatter(cluster).forEach((el) => group.appendChild(el))
            this.el.appendChild(group)
        }
    }

    private scatter(cluster: readonly MapNode[]): HTMLElement[] {
        const nodes = [...cluster].sort((a, b) => a.x - b.x)
        const props = nodes[0]!.scenery.props
        const random = seededRandom(parseInt(nodes[0]!.id.slice(0, 8), 16) || 1)

        const minX = Math.min(...nodes.map((node) => node.x - node.width / 2))
        const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2))
        const minY = Math.min(...nodes.map((node) => node.y - node.height / 2))
        const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2))

        // 横に長い塊ほど多く置く
        const count = Math.min(props.length, Math.max(3, Math.round((maxX - minX) / 130)))
        const elements: HTMLElement[] = []

        for (let i = 0; i < count; i++) {
            const prop = props[i]!
            const r = (prop.size * PROP_SCALE * (0.85 + random() * 0.3)) / 2

            for (let tries = 0; tries < 40; tries++) {
                const above = random() < 0.5
                const x = minX - 20 + random() * (maxX - minX + 40)
                const y = above ? minY - ABOVE_GAP - r - random() * BAND : maxY + BELOW_GAP + r + random() * BAND
                if (!this.isFree(x, y, r)) continue

                this.placed.push({ x, y, r })

                const el = document.createElement("div")
                el.className = `map-prop tone-${prop.tone} motion-${prop.motion}`
                el.style.left = `${x}px`
                el.style.top = `${y}px`
                el.style.width = `${r * 2}px`
                el.style.height = `${r * 2}px`
                el.style.setProperty("--tilt", `${prop.spin ? random() * 360 : (random() - 0.5) * 24}deg`)
                el.style.setProperty("--flip", random() < 0.5 ? "-1" : "1")
                el.style.setProperty("--delay", `${-random() * 10}s`)
                el.innerHTML = `<svg viewBox="-12 -12 24 24">${prop.svg}</svg>`
                elements.push(el)
                break
            }
        }

        return elements
    }

    // 半径 r の小物を (x, y) に置いても、ノード・辺・ほかの小物に重ならないか
    private isFree(x: number, y: number, r: number): boolean {
        const touchesNode = this.graph.nodes.some((node) => {
            const nx = Math.max(node.x - node.width / 2, Math.min(x, node.x + node.width / 2))
            const ny = Math.max(node.y - node.height / 2, Math.min(y, node.y + node.height / 2))
            return Math.hypot(x - nx, y - ny) < r + 14
        })
        if (touchesNode) return false

        const touchesEdge = this.graph.edges.some((edge) => {
            const dx = edge.to.x - edge.from.x
            const dy = edge.to.y - edge.from.y
            const t = Math.max(
                0,
                Math.min(1, ((x - edge.from.x) * dx + (y - edge.from.y) * dy) / (dx * dx + dy * dy || 1)),
            )
            return Math.hypot(x - (edge.from.x + dx * t), y - (edge.from.y + dy * t)) < r + 8
        })
        if (touchesEdge) return false

        return this.placed.every((p) => Math.hypot(x - p.x, y - p.y) >= r + p.r + 6)
    }
}
