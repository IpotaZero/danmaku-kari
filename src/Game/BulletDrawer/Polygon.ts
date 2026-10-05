import { Vec, vec } from "@ipota/vec"

// 多角形弾の形。見た目と当たり判定がずれないよう、両者はここだけを参照する
export namespace Polygon {
    export type Type = "wedge" | "diamond" | "triangle"

    // 進行方向を+xとしたローカル座標での頂点(凸多角形に限る)
    // 当たり判定の足切りに使うため、頂点はすべて原点から r 以内に収める
    export function vertices(type: Type, r: number): Vec[] {
        switch (type) {
            // 先端, 後端の左右
            case "wedge":
                return [vec(r, 0), vec(-r * 0.9, r * 0.4), vec(-r * 0.9, -r * 0.4)]
            // 前, 右, 後, 左
            case "diamond":
                return [vec(r, 0), vec(0, r * 0.4), vec(-r, 0), vec(0, -r * 0.4)]
            // 正三角形。先端, 後端の左右
            case "triangle":
                return [vec(r, 0), vec(-r / 2, (r * Math.sqrt(3)) / 2), vec(-r / 2, (-r * Math.sqrt(3)) / 2)]
        }
    }
}
