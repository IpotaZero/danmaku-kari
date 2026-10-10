import { PlayerData } from "../Data/PlayerData"
import type { MapGraph } from "./MapGraph"

// 並べる印どうしの間隔(ワールド座標px)
const SEAL_SPACING = 36

// 道場主のノードの外接円から、最初の印までの距離(ワールド座標px)。選ばれて少し大きくなったノードや、その角の星に重ならないだけ離す
const SEAL_MARGIN = 40

// すべての免状が条件の辺(最後の場所への関所)に、免状の印を数珠のように並べる。
// 印は免状を授けるノード(道場主)ごとに一つ、その場所の絵柄を丸の中に描き、地図と同じく季節の順(左から右)に並べる。
// 授かった免状は金で塗り、まだのものは輪だけにする。まだ行けない場所の絵柄は、ノードと同じく伏せておく
export class MapBadgeSeals {
    readonly el = document.createElement("div")

    constructor(graph: MapGraph, playerData: PlayerData) {
        this.el.className = "map-badge-seals"

        const masters = graph.nodes.filter((node) => node.badge).sort((a, b) => a.x - b.x)

        for (const edge of graph.edges.filter((edge) => edge.condition.name === "badges")) {
            // 辺の手前側(道場主のノードのすぐ外)から、辺に沿って並べる。道場主を選んだときに画面の中に収まるようにする
            const len = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y) || 1
            const start = Math.hypot(edge.from.width, edge.from.height) / 2 + SEAL_MARGIN

            masters.forEach((master, i) => {
                const offset = start + i * SEAL_SPACING

                const el = document.createElement("div")
                el.className = "map-badge-seal"
                el.classList.toggle("earned", playerData.hasBadge(master.badge!))
                el.classList.toggle("locked", !graph.isUnlocked(master, playerData))
                el.style.left = `${edge.from.x + ((edge.to.x - edge.from.x) / len) * offset}px`
                el.style.top = `${edge.from.y + ((edge.to.y - edge.from.y) / len) * offset}px`
                el.innerHTML = `<svg class="map-node-motif" viewBox="-12 -12 24 24">${master.scenery.motif.content}</svg>`
                this.el.appendChild(el)
            })
        }
    }
}
