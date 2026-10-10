import { vec } from "@ipota/vec"
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
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.riflemen)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.04, 1, 2)

    readonly riflemen = [0, 1].flatMap((rank) => [0, 1, 2, 3].map((i) => new Rifleman(this.game, this, rank, i)))

    constructor(game: Game) {
        super(game, 800, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cannon(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 200).add(this.home())
        yield
    }

    private *cannon() {
        yield* remodel(this)
            .format("big-ball")
            .color("#ffc0a0")
            .p(this.p.clone())
            .speed(4)
            .radian(T / 4 + (this.random() - 0.5) * 1.4)
            .g(function* (b) {
                yield* Behavior.stop(b, 40)

                yield* remodel(this)
                    .format("small-ball")
                    .r(5)
                    .color("#ffd8c0")
                    .p(b.p.clone())
                    .speed(3.5)
                    .radian(this.random() * T)
                    .ex(14)
                    .fire(this.game.bullets)

                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(90)
    }
}

class Rifleman extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly rank: number,
        private readonly i: number,
    ) {
        super(game, parent, 220, Size.S, 150 + rank * 45)
    }

    protected place() {
        return vec((this.i - 1.5) * 90 + (this.rank === 0 ? -22 : 22), 120 - this.rank * 45)
    }

    protected *attack() {
        const start = this.p.clone()
        const aim = this.game.player.p.sub(start).radian()

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ffe0a0")
            .r(2)
            .speed(0)
            .p(start)
            .radian(aim)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.1, 8)
                yield* Array(20)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(30)

        yield* remodel(this)
            .format("line")
            .color("#ffe0a0")
            .p(start)
            .radian(aim)
            .speed(12)
            .duplicate(5)
            .delayByIndex(3)
            .fire(this.game.bullets)

        yield* Array(70)
    }
}
