import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const core = new EnemyCore(this.game)
        this.game.enemies.push(core)
        this.game.enemies.push(...Array.from({ length: 3 }, (_, i) => new EnemyMob(this.game, core, i)))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyCore extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.4, 5, 6)

    constructor(game: Game) {
        super(game, 2400, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4)
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.attack(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 400).add(this.center())
        yield
    }

    private *attack() {
        yield* GenUtils.repeat(4, () => this.attack1())
        yield* Array(180)
        yield* GenUtils.repeat(4, () => this.attack2())
        yield* Array(480)
    }

    private *attack1() {
        yield* remodel(this)
            .scatter({ x: [this.game.WIDTH / 2 - 10, this.game.WIDTH / 2 + 10] })
            .format("diamond")
            .speed(1)
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

        yield* Array(60)
    }

    private *attack2() {
        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .radian(T / 4)
            .nway(2, T / 4)
            .nway(3, T / 24)
            .sim(3, 3, 4)
            .scatter({ hue: [0, 360] })
            .bounce(1)
            .fire(this.game.bullets)

        yield* Array(60)
    }
}

class EnemyMob extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1200, Size.S)
        this.setParent(parent, () => vec.arg(this.frame / 360 + T * (index / 3)).scale(120))

        this.scripts.add(() => this.attack(), { loop: Infinity })
    }

    private *attack() {
        yield* remodel(this)
            .colorful(this.frame)
            .format("small-ball")
            .p(this.p.clone())
            .aim(this.game.player)
            .nway(17, T / 24)
            .delayByIndex()
            .speed(12)
            .g((me) => Behavior.reaccel(me, 30, 30, 60, 6))
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
