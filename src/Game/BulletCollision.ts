import { Vec } from "@ipota/vec"
import { T } from "../T"
import { Bullet } from "./Actor/Bullet"
import { Polygon } from "./BulletDrawer/Polygon"

type Circle = {
    p: Vec
    r: number
}

// 弾は毎フレーム数百発を判定するので、Vecや配列を作らずに数値だけで計算する(GC対策)
export class BulletCollision {
    // 半径1の多角形の頂点。頂点は r に比例するので、形ごとに一度だけ作って r 倍して使う
    private readonly unitVertices = new Map<Polygon.Type, Vec[]>()

    isColliding(b: Bullet, e: Circle) {
        if (b.collision === "rect") return this.isCollidingRect(e, b)

        // rect 以外の形はすべて半径 r の円に収まるので、その円に触れていなければ細かい判定をせずに打ち切る
        const dx = b.p.x - e.p.x
        const dy = b.p.y - e.p.y
        if (dx * dx + dy * dy > (b.r + e.r) ** 2) return false

        if (b.collision === "circle") return true

        const cos = Math.cos(b.radian)
        const sin = Math.sin(b.radian)

        if (b.collision === "line") {
            return this.isCollidingLine(
                e,
                b.p.x + cos * b.r,
                b.p.y + sin * b.r,
                b.p.x - cos * b.r,
                b.p.y - sin * b.r,
            )
        } else if (b.collision === "arrow") {
            const 右端x = b.p.x + cos * b.r
            const 右端y = b.p.y + sin * b.r

            return (
                this.isCollidingLine(e, 右端x, 右端y, b.p.x - cos * b.r, b.p.y - sin * b.r) ||
                this.isCollidingLine(
                    e,
                    右端x,
                    右端y,
                    右端x + Math.cos((-3 / 8) * T + b.radian) * b.r,
                    右端y + Math.sin((-3 / 8) * T + b.radian) * b.r,
                ) ||
                this.isCollidingLine(
                    e,
                    右端x,
                    右端y,
                    右端x + Math.cos((-5 / 8) * T + b.radian) * b.r,
                    右端y + Math.sin((-5 / 8) * T + b.radian) * b.r,
                )
            )
        } else {
            return this.isCollidingPolygon(e, b, b.collision, cos, sin)
        }
    }

    // 線分 (sx, sy)-(ex, ey) に円が触れているか
    private isCollidingLine({ p, r }: Circle, sx: number, sy: number, ex: number, ey: number) {
        const segmentX = ex - sx
        const segmentY = ey - sy
        const toCircleX = p.x - sx
        const toCircleY = p.y - sy

        const segLenSq = segmentX * segmentX + segmentY * segmentY
        const t = Math.max(0, Math.min(1, (toCircleX * segmentX + toCircleY * segmentY) / segLenSq))

        const dx = toCircleX - segmentX * t
        const dy = toCircleY - segmentY * t
        return dx * dx + dy * dy <= r ** 2
    }

    // 円の中心が凸多角形の内側にあるか、いずれかの辺に円が触れていれば衝突
    private isCollidingPolygon(circle: Circle, b: Bullet, type: Polygon.Type, cos: number, sin: number) {
        let vertices = this.unitVertices.get(type)
        if (!vertices) {
            vertices = Polygon.vertices(type, 1)
            this.unitVertices.set(type, vertices)
        }

        // 全ての辺に対して同じ側にあれば内側
        let allPositive = true
        let allNegative = true

        for (let i = 0; i < vertices.length; i++) {
            const start = vertices[i]
            const end = vertices[(i + 1) % vertices.length]

            // 弾の向きに回して r 倍し、弾の位置へ置く
            const sx = b.p.x + (start.x * cos - start.y * sin) * b.r
            const sy = b.p.y + (start.x * sin + start.y * cos) * b.r
            const ex = b.p.x + (end.x * cos - end.y * sin) * b.r
            const ey = b.p.y + (end.x * sin + end.y * cos) * b.r

            if (this.isCollidingLine(circle, sx, sy, ex, ey)) return true

            const side = (ex - sx) * (circle.p.y - sy) - (ey - sy) * (circle.p.x - sx)
            if (side < 0) allPositive = false
            if (side > 0) allNegative = false
        }

        return allPositive || allNegative
    }

    /**
     * ビーム(回転した矩形)と円の当たり判定。
     * 矩形は b.p を始点に radian 方向へ length、太さ r * 2
     */
    private isCollidingRect(circle: Circle, b: Bullet) {
        const cos = Math.cos(b.radian)
        const sin = Math.sin(b.radian)

        // 始点を b.p に固定するため、中心を進行方向に length/2 だけオフセットする
        const dx = circle.p.x - (b.p.x + cos * (b.length / 2))
        const dy = circle.p.y - (b.p.y + sin * (b.length / 2))

        // 円の中心を矩形の中心相対に移動し、逆回転させて矩形のローカル座標（AABB状態）に合わせる
        const localX = dx * cos + dy * sin
        const localY = -dx * sin + dy * cos

        const halfW = b.length / 2
        const halfH = b.r

        // ローカル空間上のAABBに対して、最も円に近い点をクランプで求める
        const closestX = Math.max(-halfW, Math.min(localX, halfW))
        const closestY = Math.max(-halfH, Math.min(localY, halfH))

        // 最近接点と円の中心の距離が半径以内なら衝突
        return (localX - closestX) ** 2 + (localY - closestY) ** 2 <= circle.r ** 2
    }
}
