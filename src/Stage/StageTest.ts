import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { remodel } from "../Game/Remodel"
import { Stage } from "./Stage"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["...."])

        this.game.enemies.push(new EnemyTest(this.game))
    }
}

class EnemyTest extends Enemy {
    constructor(game: Game) {
        super(game, 100, 32)

        this.addScript(() => this.G(), { loop: Infinity })
    }

    private *G() {
        yield* remodel(this).p(this.p).aim(this.game.player.p).fire(this.game.bullets)
        yield* Array(30)
    }
}
