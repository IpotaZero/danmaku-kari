import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const master = new EnemyPolaris(this.game)
        this.game.enemies.push(master, ...master.stars)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPolaris extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.15, this.game.HEIGHT * 0.03, 1, 2)

    readonly stars = [
        vec(2.4, 0.05),
        vec(1.85, -0.15),
        vec(1.4, 0),
        vec(0.85, 0.15),
        vec(0.75, 0.65),
        vec(0.1, 0.55),
        vec(0, 0),
    ].map((p, i, all) => {
        const center = all.reduce((sum, q) => sum.add(q), vec(0, 0)).scale(1 / all.length)
        const offset = p.sub(center).scale(100)

        return new Star(this.game, this, offset, i)
    })

    constructor(game: Game) {
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.arrows(), { loop: Infinity, margin: 80 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 300).add(this.home())
        yield
    }

    private *arrows() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(1)
            .aim(this.game.player)
            .nway(3, T / 24)
            .g((me) => Behavior.ease(me, "speed", 7.5, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }
}

class Star extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly offset: Vec,
        private readonly i: number,
    ) {
        super(game, parent, 260, Size.S, 150)
    }

    protected place() {
        const angle = this.frame / 95
        return vec.arg(angle).scale(175).add(this.offset.rotate(angle))
    }

    protected *attack() {
        yield* Array(this.i * 10)

        yield* remodel(this)
            .format("diamond")
            .color(this.i % 2 === 0 ? "#fff4b0" : "#b8e0ff")
            .p(this.p.clone())
            .radian(this.random() * T)
            .ex(10)

            .forEach((b, k) => {
                b.speed = k % 2 === 0 ? 4.5 : 2.6
            })
            .g((b) => Behavior.ease(b, "speed", b.speed * 1.4, 60, Ease.In))
            .fire(this.game.bullets)

        yield* Array(300 - this.i * 10)
    }
}
