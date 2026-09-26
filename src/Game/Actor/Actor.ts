import { vec, Vec } from "@ipota/vec"
import { IteratorQueue } from "../IteratorQueue"
import { Game } from "../Game"

export abstract class Actor extends IteratorQueue {
    p: Vec = vec(0, 0)
    r: number = 8
    life = 1

    constructor(readonly game: Game) {
        super()
    }
}
