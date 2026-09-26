import { Actor } from "./Actor"
import { Game } from "../Game"
import { Vec } from "@ipota/vec"

export class Player extends Actor {
    private readonly maxLife = 10

    // クールダウンはジェネレータ内で保持
    private isInvincibleBecauseOfHit = false

    constructor(game: Game, startPosition: Vec) {
        super(game)
        this.p = startPosition
        this.life = this.maxLife
    }

    draw(ctx: CanvasRenderingContext2D): void {}

    isInvincible() {
        return this.isInvincibleBecauseOfHit
    }
}
