import { Game } from "../Game/Game"
import { IteratorQueue } from "../Game/IteratorQueue"

export abstract class Stage extends IteratorQueue {
    constructor(protected readonly game: Game) {
        super()
        this.addScript(() => this.G())
    }

    abstract G(): Generator<void, void, void>
}
