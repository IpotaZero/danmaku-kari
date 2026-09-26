import { vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { Remodel, remodel } from "../Game/Remodel"
import { Stage } from "./Stage"
import { EnemyRendererCore } from "../Game/Actor/EnemyRendererCore"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["...."])

        this.game.enemies.push(new EnemyTest(this.game))
    }
}

class EnemyTest extends Enemy {
    constructor(game: Game) {
        super(game, 100, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.move())
    }

    private *move() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), 60)

        this.addScript(() => this.G(), { loop: Infinity })
    }

    private *G() {
        yield* remodel(this)
            .colorful(this.frame)
            .p(this.p.clone())
            .aim(this.game.player.p)
            .ex(31)
            .delayByIndex()
            .g((me, i) => Remodel.reaccel(me, 30, 30 - i, 30))
            .fire(this.game.bullets)

        yield* Array(30)
    }
}
