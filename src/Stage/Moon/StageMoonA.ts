import { vec } from "@ipota/vec"
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
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, ...pupil.moons)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 2, 3)

    readonly moons = [0, 1, 2, 3].map((i) => new Moon(this.game, this, i))

    constructor(game: Game) {
        super(game, 1400, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 350).add(this.home())
        yield
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(4.5)
            .radian(this.random() * T)
            .ex(37)
            .g((me) => Behavior.reaccel(me, 20, 25, 30, 5))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}

class Moon extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 400, Size.S, 140 + i * 30)
    }

    protected place() {
        const angle = this.frame / 70 + (T * this.i) / 4
        return vec(Math.cos(angle) * 190, Math.sin(angle) * 80)
    }

    protected *attack() {
        const aim = this.game.player.p.sub(this.p).radian()

        yield* remodel(this)
            .format("diamond")
            .color((["#fff2c0", "#e0d8ff", "#c8e8ff", "#ffd8e8"] as Color[])[this.i])
            .speed(1.5)
            .radian(aim)
            .duplicate(9, (b, k) => {
                b.p = this.p.add(vec.arg(aim + (k - 4) * 0.28).scale(32))
                return b
            })
            .appear(60)
            .g((b) => Behavior.ease(b, "speed", 6.5, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
