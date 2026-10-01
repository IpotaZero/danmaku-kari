import { Vec, vec } from "@ipota/vec"

// 楔形弾の形。見た目と当たり判定がずれないよう、両者はここだけを参照する
export namespace Wedge {
    // 長さ(2r)に対する、後端の半幅の比
    const HALF_WIDTH = 0.4

    // 進行方向を+xとしたローカル座標での頂点(先端, 後端の左右)
    export function vertices(r: number): [Vec, Vec, Vec] {
        return [vec(r, 0), vec(-r, r * HALF_WIDTH), vec(-r, -r * HALF_WIDTH)]
    }
}
