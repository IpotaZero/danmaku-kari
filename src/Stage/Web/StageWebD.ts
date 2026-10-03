import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { GenUtils } from "../../utils/Functions/GeneratorUtils"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["なんか、すごい視線を感じるなあ。"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")

        const boss = new EnemyBoss(this.game)
        const core0 = new EnemyCore(this.game, boss, 0)
        const core1 = new EnemyCore(this.game, boss, 1)
        const core2 = new EnemyCore(this.game, boss, 2)

        this.game.enemies.push(boss, core0, core1, core2)
        core0.isInvincible = false

        const phase = boss.start()
        phase.next()

        yield* this.waitDead([core0])
        core1.isInvincible = false
        phase.next()
        this.scorenizeAllBullets()

        yield* this.waitDead([core1])
        core2.isInvincible = false
        phase.next()
        this.scorenizeAllBullets()

        yield* this.waitDead([core2])
        boss.isInvincible = false
        phase.next()
        this.scorenizeAllBullets()

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 150 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *cycle0() {
        yield* this.randomMove(60)

        // 牙
        yield* GenUtils.repeat(4, () =>
            GenUtils.all({
                "0": remodel(this)
                    .scatter({ x: [this.game.WIDTH / 2 - 30, this.game.WIDTH / 2 + 30] })
                    .format("diamond")
                    .radian(T / 4)
                    .shift(13, 60)
                    .scatter({ hue: [0, 360] })
                    .appear(30)
                    .g(function* (me) {
                        yield* Behavior.force(me, 0.1, 80)
                    })
                    .fire(this.game.bullets),

                "1": remodel(this)
                    .y(this.game.HEIGHT)
                    .scatter({ x: [this.game.WIDTH / 2 - 30, this.game.WIDTH / 2 + 30] })
                    .format("diamond")
                    .radian(-T / 4)
                    .shift(13, 60)
                    .scatter({ hue: [0, 360] })
                    .appear(30)
                    .g(function* (me) {
                        yield* Behavior.force(me, 0.1, 80)
                    })
                    .fire(this.game.bullets),
                wait: Array(60),
            }),
        )

        yield* Array(180)
    }

    private *cycle1() {}

    private *cycle2() {}

    private *cycle2_0() {}

    private *cycle2_1() {}

    private *cycle3() {}

    private *cycle3_0() {}

    private *cycle3_1() {}
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 360 + (T / 3) * index).scale(100))
        this.isInvincible = true
    }
}
