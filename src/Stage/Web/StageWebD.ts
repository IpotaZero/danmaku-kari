import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
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
        // this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: 150 })
        // yield

        // this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 150 })
        // yield

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
                upper: remodel(this)
                    .scatter({ x: [this.game.WIDTH / 2 - 30, this.game.WIDTH / 2 + 30] })
                    .format("diamond")
                    .speed(1)
                    .radian(T / 4)
                    .shift(13, 60)
                    .scatter({ hue: [0, 360] })
                    .appear(30)
                    .g(function* (me) {
                        yield* Behavior.force(me, 0.1, 80)
                    })
                    .fire(this.game.bullets),

                lower: remodel(this)
                    .y(this.game.HEIGHT)
                    .scatter({ x: [this.game.WIDTH / 2 - 30, this.game.WIDTH / 2 + 30] })
                    .format("diamond")
                    .speed(1)
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

        yield* Array(120)

        for (let i = 0; i < 4; i++) {
            yield* this.randomMove(30)

            yield* remodel(this)
                .format("diamond")
                .colorful(this.frame)
                .p(this.p.clone())
                .aim(this.game.player.p)
                .speed(8)
                .ex(63)
                .g(function* (me) {
                    yield* Behavior.rotating(me, 0.01 * ((i % 2) * 2 - 1), 60)
                })
                .fire(this.game.bullets)
        }

        yield* this.randomMove(60)

        yield* Array(60)
    }

    private *cycle1() {
        yield* GenUtils.all({
            web: GenUtils.repeat(Infinity, () => this.cycle1_0()),
            fang: GenUtils.repeat(Infinity, () => this.cycle1_1()),
        })
    }

    private *cycle1_0() {
        for (let i = 0; i < 60; i++) {
            yield* remodel(this)
                .p(this.p.clone())
                .format("small-ball")
                .color("white")
                .radian(T / 4)
                .nway(2, ((Math.sin(T * (i / 60)) + 1) / 2) * (T / 15) + T / 30)
                .nway(7, T / 12)
                .speed(8)
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(60)
    }

    private *cycle1_1() {
        yield* this.randomMove(60)

        for (let i = 0; i < 16; i++) {
            yield* remodel(this)
                .p(this.p.clone())
                .format("diamond")
                .scatter({ p: 360, hue: [0, 360] })
                .aim(this.game.player.p)
                .shift(16, 120)
                .appear(30)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .fire(this.game.bullets)

            yield* Array(5)
        }

        yield* Array(360)
    }

    private *cycle2() {
        yield* GenUtils.repeat(4, () => this.cycle2_0())
        yield* Array(30)
        yield* this.moveTo(this.game.player.p, 60, 0.3)
        yield* this.cycle2_1()
        yield* this.randomMove(60)
    }

    private *cycle2_0() {
        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .aim(this.game.player.p)
            .duplicate(4)
            .speed(8)
            .delayByIndex(6)
            .nway(8, T / 129)
            .g(function* (me, _, __, j) {
                const radian = me.radian
                for (let i = 0; i < Infinity; i++) {
                    me.radian = radian + Math.cos(i / 36) * (T / 12) * (2 * (j % 2) - 1)
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(30)
    }

    private *cycle2_1() {
        const radian = this.game.player.p.sub(this.p).radian()

        yield* remodel(this)
            .p(this.p.clone())
            .beam(250)
            .radian(radian)
            .nway(2, T / 6)
            .alpha(0)
            .g(function* (me, i) {
                yield* Behavior.fadein(me, 30)

                yield* Behavior.ease(me, "radian", radian, 50, Ease.InBack)

                yield* Behavior.fadeout(me, 30)
            })
            .fire(this.game.bullets)

        yield* Array(80)

        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .duplicate(4)
            .delayByIndex(20)
            .duplicate(63)
            .scatter({ radian: [0, T], hue: [0, 360] })
            .speed(0)
            .g((me) => Behavior.accel(me, 60, 6))
            .fire(this.game.bullets)

        yield* Array(120)
    }

    private *cycle3() {
        yield
    }

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
