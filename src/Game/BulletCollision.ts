import { Vec, vec } from "@ipota/vec"
import { T } from "../T"
import { Bullet } from "./Actor/Bullet"

type Circle = {
    p: Vec
    r: number
}

type Line = {
    start: Vec
    end: Vec
}

type Rect = { p: Vec; w: number; h: number; rad: number }

export class BulletCollision {
    isColliding(b: Bullet, e: Circle) {
        if (b.collision === "ball") {
            return this.isCollidingCircle({ p: b.p, r: b.r }, { p: e.p, r: e.r })
        } else if (b.collision === "line") {
            const circle: Circle = e
            const line = {
                start: b.p.add(vec.arg(b.radian).scale(b.r)),
                end: b.p.sub(vec.arg(b.radian).scale(b.r)),
            }
            return this.isCollidingLine(circle, line)
        } else if (b.collision === "arrow") {
            const circle: Circle = e

            const 右端 = b.p.add(vec.arg(b.radian).scale(b.r))
            const 左端 = b.p.sub(vec.arg(b.radian).scale(b.r))

            const line0 = { start: 右端, end: 左端 }
            const line1 = {
                start: 右端,
                end: 右端.add(vec.arg((-3 / 8) * T + b.radian).scale(b.r)),
            }
            const line2 = {
                start: 右端,
                end: 右端.add(vec.arg((-5 / 8) * T + b.radian).scale(b.r)),
            }

            return (
                this.isCollidingLine(circle, line0) ||
                this.isCollidingLine(circle, line1) ||
                this.isCollidingLine(circle, line2)
            )
        } else if (b.collision === "laser") {
            // ビーム判定: 始点を b.p に固定するため、中心を進行方向に length/2 だけオフセットする
            return this.isCollidingRect(e, {
                p: b.p.add(vec.arg(b.radian).scale(b.length / 2)),
                w: b.length, // radian方向（ローカルX軸）の長さ
                h: b.r * 2, // 垂直方向（ローカルY軸）の太さ
                rad: b.radian,
            })
        }
    }

    private isCollidingCircle({ p: p1, r: r1 }: Circle, { p: p2, r: r2 }: Circle) {
        const distance = p1.sub(p2).magnitude()
        const radiusSum = r1 + r2
        return distance <= radiusSum
    }

    private isCollidingLine({ p, r }: Circle, { start, end }: Line) {
        const segment = end.sub(start)
        const toCircle = p.sub(start)

        const segLenSq = segment.magnitudeSquared()
        const t = Math.max(0, Math.min(1, toCircle.dot(segment) / segLenSq))

        const closest = start.add(segment.scale(t))
        const distSq = p.sub(closest).magnitudeSquared()
        return distSq <= r ** 2
    }

    /**
     * 回転した矩形と円の当たり判定
     */
    private isCollidingRect(circle: Circle, rect: Rect) {
        // 円の中心を矩形の中心相対に移動し、逆回転させて矩形のローカル座標（AABB状態）に合わせる
        // Vec.ts の rotate メソッドを使用して逆回転を適用
        const localP = circle.p.sub(rect.p).rotate(-rect.rad)

        const halfW = rect.w / 2
        const halfH = rect.h / 2

        // ローカル空間上のAABBに対して、最も円に近い点をクランプで求める
        const closestX = Math.max(-halfW, Math.min(localP.x, halfW))
        const closestY = Math.max(-halfH, Math.min(localP.y, halfH))
        const closest = vec(closestX, closestY)

        // 最近接点と円の中心の距離が半径以内なら衝突
        return localP.sub(closest).magnitudeSquared() <= circle.r ** 2
    }
}
