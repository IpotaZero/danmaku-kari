import { vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { Remodel, remodel } from "../Game/Remodel"
import { Stage } from "./Stage"
import { EnemyRendererCore } from "../Game/Actor/EnemyRendererCore"
import { T } from "../T"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["...."])

        const parent = new EnemyBoss(this.game)
        this.game.enemies.push(parent)
        this.game.enemies.push(new EnemySatellite(this.game, parent, 1))
        this.game.enemies.push(new EnemySatellite(this.game, parent, -1))

        yield* this.waitAllEnemiesDead()
        this.shake(16, 60)
        this.flash("#ffffff", 12)
        this.scorenizeAllBullets()
    }
}

class EnemyBoss extends Enemy {
    constructor(game: Game) {
        super(game, 1200, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.move())
    }

    private *move() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), 150)

        this.addScript(() => this.sway())
        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *sway() {
        const centerX = this.game.WIDTH / 2

        let i = 0
        while (true) {
            this.p.x = centerX + Math.sin(i++ / 90) * 60
            yield
        }
    }

    private *attack() {
        const curveSpeed = T / 200
        const curveFrames = 50

        yield* this.fan(1, curveSpeed, curveFrames)
        yield* Array(9)
        yield* this.fan(-1, curveSpeed, curveFrames)
        yield* Array(9)
    }

    private *fan(dir: 1 | -1, curveSpeed: number, curveFrames: number) {
        yield* remodel(this)
            .colorful(this.frame)
            .p(this.p.clone())
            .appearance("ball")
            .r(4)
            .radian(T / 4)
            .speed(2)
            .nway(9, T / 16)
            .g(function* (me) {
                for (let i = 0; i < curveFrames; i++) {
                    me.radian += curveSpeed * dir
                    yield
                }
            })
            .fire(this.game.bullets)
    }
}

class EnemySatellite extends Enemy {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: 1 | -1,
    ) {
        super(game, 600, 20)

        this.setParent(parent, () => vec(Math.cos(this.frame / 720) * 140 * this.side, Math.sin(this.frame / 720) * 60))

        this.addScript(() => this.startAttack())
    }

    private *startAttack() {
        yield* Array(150)

        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *attack() {
        const baseAngle = T / 4 + Math.sin(this.frame / 50) * (T / 10)

        yield* remodel(this)
            .colorful(this.frame)
            .p(this.p.clone())
            .appearance("donut")
            .r(12)
            .radian(baseAngle)
            .speed(3)
            .nway(3, T / 12)
            .fire(this.game.bullets)

        yield* Array(16)
    }
}
