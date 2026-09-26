import { vec, Vec } from "@ipota/vec"
import { Actor } from "./Actor"
import { Game } from "../Game"

export class Camera extends Actor {
    p: Vec
    angle = 0
    scale = 1.5

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
}
