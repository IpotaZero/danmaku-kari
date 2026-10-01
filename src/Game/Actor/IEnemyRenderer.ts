import { Enemy } from "./Enemy"

export interface IEnemyRenderer {
    draw(ctx: CanvasRenderingContext2D, e: Enemy): void
    // 撃破演出
    onDead(e: Enemy): Generator<void, void, void>
}
