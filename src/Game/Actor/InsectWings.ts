import { Enemy } from "./Enemy"

// 敵の翅の形。根元を(0,0)、翅の先を+x、前縁を-yに向けて描く。長さはどちらも前翅の38を基準にする
// 蜂(Player)の翅より細長く、翅脈が網のように細かい。トンボやセミのような翅
namespace InsectWingShape {
    export const LENGTH = 38

    // 前翅。細長く、先端は丸い
    export const fore = new Path2D(
        "M0 -0.6 C8 -2.4 18 -3.2 28 -3.4 C34 -3.4 38 -2.4 38 -0.6 C38 1.6 34 3.2 28 3.4 C20 3.6 10 2.6 3 1.2 C1.5 0.8 0.4 0.5 0 0.3 Z",
    )
    // 前翅の翅脈。縦に走る3本と、それをつなぐ横脈、先の方の縁紋
    export const foreVeins = new Path2D(
        "M1 -0.6 C10 -2.2 20 -2.9 30 -3.1 M2 0.2 C12 0 22 -0.4 36 -0.8 M3 0.8 C12 1.6 22 2.4 32 2.6 M8 -1.6 L9 1.6 M14 -2.3 L15 2.1 M20 -2.7 L21 2.6 M26 -3 L27 2.9 M30 -3.1 L32 -2.9 L32 -1 L30 -0.9 Z",
    )
    // 後翅。前翅より短く、後ろ側がふくらむ
    export const hind = new Path2D(
        "M0 -0.5 C7 -2 15 -2.8 22 -2.8 C27 -2.8 30 -1.6 30 0.2 C30 2.6 26 4.6 19 4.8 C12 5 6 3.6 2.5 2 C1.2 1.4 0.3 0.8 0 0.4 Z",
    )
    export const hindVeins = new Path2D(
        "M1 -0.4 C8 -1.4 16 -2 24 -2 M2 0.6 C10 1.2 18 1.6 28 1.2 M10 -1.6 L11 3.4 M17 -2 L18 4.2 M23 -1.9 L23.5 3.6",
    )
}

/**
 * 敵の体の左右に生える2対の翅。敵は自機のいる下(+y)を向いているものとして描く。
 * 翅は見た目だけで、当たり判定は持たない。弾と見間違えないよう、大きな形を薄い線で描く。
 */
export class InsectWings {
    /**
     * @param span 前翅の長さ(e.rの何倍か)
     * @param beat 羽ばたきの速さ(1フレームあたりの位相[rad])
     */
    constructor(
        readonly span: number,
        readonly beat: number,
    ) {}

    draw(ctx: CanvasRenderingContext2D, e: Enemy): void {
        const s = (e.r * this.span) / InsectWingShape.LENGTH
        // 真横を0として、後ろ(上)へ回る向きを正にした、翅を振る範囲
        const front = -0.5
        const back = 0.8
        const angle = (front + back) / 2 + ((back - front) / 2) * 0.8 * Math.sin(e.frame * this.beat)

        for (const side of [-1, 1]) {
            ctx.save()
            ctx.translate(e.p.x, e.p.y)
            // 前縁(-y)が下(自機の側)を向くように上下を返す
            ctx.scale(side, -1)

            // 前翅と後翅は少しずれて動く。根元は体の縁から生やす
            for (const [rootY, lag, length, shape, veins] of [
                [-0.2, 0, 38, InsectWingShape.fore, InsectWingShape.foreVeins],
                [0.25, 0.25, 30, InsectWingShape.hind, InsectWingShape.hindVeins],
            ] as const) {
                ctx.save()
                ctx.translate(e.r * 0.8, e.r * rootY)
                ctx.scale(s, s)
                ctx.lineWidth = 1 / s

                // 羽ばたきの残像の扇
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.arc(0, 0, length * 0.95, front + lag, back + lag)
                ctx.closePath()
                ctx.fillStyle = "rgba(255, 255, 255, 0.04)"
                ctx.fill()

                ctx.rotate(angle + lag)
                ctx.fillStyle = "rgba(255, 255, 255, 0.07)"
                ctx.fill(shape)
                ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
                ctx.stroke(shape)
                ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"
                ctx.stroke(veins)
                ctx.restore()
            }

            ctx.restore()
        }
    }
}
