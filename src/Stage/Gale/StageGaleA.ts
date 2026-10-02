import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyCore(this.game))
        yield* this.waitAllEnemiesDead()
    }
}

class EnemyCore extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.4, 5, 6)

    constructor(game: Game) {
        super(game, 2400, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4)
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.attack(), { loop: Infinity })
        this.addScript(() => this.attack2(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 900).add(this.center())
        yield
    }

    private *attack() {
        yield* Array(120)
    }

    private *attack2() {
        yield* remodel(this)
            .p(this.p.clone())
            .duplicate(31)
            .scatter({ radian: [0, -T / 2], speed: [4, 8], hue: [0, 360] })
            .format("diamond")
            .fire(this.game.bullets)

        yield* Array(120)

        yield* remodel(this)
            .scatter({ x: [this.game.WIDTH / 2 - 10, this.game.WIDTH / 2 + 10] })
            .format("diamond")
            .radian(T / 4)
            .shift(13, 60)
            .scatter({ hue: [0, 360] })
            .appear(30)
            .g(function* (me) {
                while (1) {
                    me.speed += 0.1
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* remodel(this)
            .p(this.p.clone())
            .duplicate(31)
            .scatter({ radian: [0, T / 2], speed: [4, 8], hue: [0, 360] })
            .format("diamond")
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
