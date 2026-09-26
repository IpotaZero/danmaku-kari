import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Game } from "../Game"

export type CameraTransform = {
    x: number
    y: number
    angle: number
    scale: number
}

export class Camera extends Actor {
    p: Vec
    angle = 0
    // 1にすることで、ワールド座標の [0, WIDTH] x [0, HEIGHT] が画面にちょうど収まる
    // (Player.move() のクランプ範囲と一致させ、自機が画面外に出ないようにするため)
    scale = 1

    private shakeP = vec(0, 0)

    constructor(game: Game, firstPosition: Vec) {
        super(game)
        this.p = firstPosition
    }

    // ctx をカメラ視点に合わせて変換する
    apply(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        ctx.translate(width / 2, height / 2)
        ctx.rotate(this.angle)
        ctx.scale(this.scale, this.scale)
        ctx.translate(-this.p.x - this.shakeP.x, -this.p.y - this.shakeP.y)
    }

    // GPUでの弾描画など、ctxを介さずに同じ変換を再現したい相手へ渡すためのスナップショット
    getTransform(): CameraTransform {
        return {
            x: this.p.x + this.shakeP.x,
            y: this.p.y + this.shakeP.y,
            angle: this.angle,
            scale: this.scale,
        }
    }
}
