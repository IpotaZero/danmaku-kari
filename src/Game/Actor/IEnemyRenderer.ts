import { Enemy } from "./Enemy"

export interface IEnemyRenderer {
    draw(ctx: CanvasRenderingContext2D, e: Enemy): void
}
