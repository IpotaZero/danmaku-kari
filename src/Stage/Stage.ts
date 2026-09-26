import { Game } from "../Game/Game"
import { IteratorQueue } from "../Game/IteratorQueue"

export abstract class Stage extends IteratorQueue {
    constructor(protected readonly game: Game) {
        super()
        this.addScript(() => this.G(), { id: "runToEnd" })
    }

    // G()が最後まで到達したらステージクリア
    get isCleared(): boolean {
        return !this.scripts.has("runToEnd")
    }

    abstract G(): Generator<void, void, void>

    protected *waitAllEnemiesDead(): Generator<void, void, void> {
        while (this.game.enemies.length > 0) {
            yield
        }
    }

    protected scorenizeAllBullets() {
        this.game.bullets.forEach((b) => b.scorenize())
    }
}
