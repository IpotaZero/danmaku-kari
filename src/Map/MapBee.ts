import { Silhouette } from "../utils/Silhouette"
import type { MapNode } from "./MapGraph"

// 地図の上の自機(蜂)。選んだノードへ飛んでいき、その上にとまる。
// 文字の説明の代わりに、いま自分がどこにいるのかを、地図の上にいる自分の姿で示す
export class MapBee {
    readonly el = document.createElement("div")

    // いまとまっているノードの位置。次に飛ぶ向きを決めるのに使う
    private x: number

    constructor(node: MapNode) {
        this.el.className = "map-bee"
        this.el.innerHTML = `
            <div class="map-bee-body">
                <svg viewBox="-14 -14 28 28" fill="currentColor">${Silhouette.bugs.bee.content}</svg>
            </div>`

        this.x = node.x
        this.el.style.left = `${node.x}px`
        this.el.style.top = `${node.y - node.height / 2}px`
    }

    // node の上へ飛ぶ。左へ飛ぶときは左を向く(カメラと同じ速さで移るので、画面の中ではほとんど動かずに羽ばたいて見える)
    flyTo(node: MapNode) {
        if (node.x !== this.x) this.el.classList.toggle("facing-left", node.x < this.x)

        this.x = node.x
        this.el.style.left = `${node.x}px`
        this.el.style.top = `${node.y - node.height / 2}px`
    }
}
