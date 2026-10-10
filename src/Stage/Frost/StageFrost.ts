import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const CYCLE_FRAMES = 900

const SNOW_FRAMES = 150

const GROW_FRAMES = 30

const DROP_FRAMES = 420

const FALL_SPEED = 4
const DROP_SPEED = 12

const AREA_PER_SNOW = 9000

export default class extends Stage {
    *G() {
        const boss = new EnemyFrost(this.game)
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

class EnemyFrost extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.1, 2, 3)

    constructor(game: Game) {
        super(game, 2400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
    }

    *start() {
        this.scripts.add(() => this.cycle0(), { loop: Infinity, id: "cycle" })
        yield

        this.scripts.add(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.scripts.add(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.scripts.add(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 150 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 600).add(this.home())
        yield
    }

    private *cycle0() {
        yield* remodel(this)
            .format("small-ball")
            .color("#dff6ff")
            .p(this.p.clone())
            .speed(FALL_SPEED)
            .duplicate(120)
            .scatter({ p: 0.5, radian: [0, -T / 2], speed: [FALL_SPEED * 0.8, FALL_SPEED * 1.2] })
            .delete(120)
            .fire(this.game.bullets)

        yield* Array(180)

        yield* GenUtils.all({
            snow: this.snowfall(),
            icicles: this.icicles(),
            ring: this.ring(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *snowfall() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const count = Math.floor((width * height) / AREA_PER_SNOW)

        yield* remodel(this)
            .format("small-ball")
            .speed(FALL_SPEED)
            .color("#dff6ff")
            .duplicate(count, (b, i) => {
                b.p = vec(this.random() * width, -3)
                b.radian = T / 4 + (this.random() - 0.5) * 0.3
                b.delay = Math.floor((i * SNOW_FRAMES) / count)
                return b
            })
            .g(function* (me) {
                const fallFrames = Math.floor((this.random() * height * 0.95) / FALL_SPEED)
                const stopFrames = 10

                yield* Array(fallFrames)
                yield* Behavior.stop(me, stopFrames)

                me.color = "#8fd8ff"
                yield* Behavior.ease(me, "r", 24, GROW_FRAMES, Ease.Out)

                yield* Array(Math.max(0, DROP_FRAMES - me.delay - fallFrames - stopFrames - GROW_FRAMES))

                me.radian = T / 4
                yield* Behavior.accel(me, 360, DROP_SPEED)
            })
            .fire(this.game.bullets)
    }

    private *icicles() {
        yield* Array(240)

        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .format("arrow")
                .p(this.p.clone())
                .speed(1.5)
                .color("#bfe9ff")
                .aim(this.game.player)
                .nway(7, T / 28)
                .g(function* (me) {
                    yield* Behavior.accel(me, 40, 5)
                })
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }

    private *ring() {
        yield* Array(270)

        const count = 120

        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .speed(1.4)
            .ex(count)
            .color("#bfe9ff")
            .fire(this.game.bullets)
    }

    private *cycle1() {
        yield* remodel(this)
            .color("#bfe9ff")
            .format("diamond")
            .p(this.p.clone())
            .duplicate(13)
            .scatter({ p: 240, radian: [0, T], speed: [3, 6] })
            .delayByIndex(2)
            .ex(13)
            .g((me) => Behavior.reaccel(me, 60, 60, 60, 4))
            .fire(this.game.bullets)

        yield* Array(120)

        yield* remodel(this)
            .color("#bfe9ff")
            .format("arrow")
            .p(this.p.clone())
            .sim(3, 4, 8)
            .delayByIndex(10)
            .ex(31)
            .fire(this.game.bullets)

        yield* Array(300)
    }

    private *cycle2() {
        yield* GenUtils.all({
            cycle0: this.cycle2_0(),
            cycle1: this.cycle2_1(),
        })
    }

    private *cycle2_0() {
        while (1) {
            yield* remodel(this)
                .color("#bfe9ff")
                .format("arrow")
                .p(this.p.clone())
                .ex(23)
                .delayByIndex()
                .ex(2)
                .g(function* (me, _, i, j) {
                    yield* Behavior.stop(me, 30)
                    yield* Array(60 - i)
                    yield* GenUtils.all({
                        accel: Behavior.accel(me, 60, 4),
                        rotate: Behavior.rotating(me, (T / 6400) * (2 * (j % 2) - 1)),
                    })
                })
                .fire(this.game.bullets)

            yield* Array(12)
        }
    }

    private *cycle2_1() {
        while (1) {
            yield* remodel(this)
                .color("#bfe9ff")
                .format("diamond")
                .p(this.p.clone())
                .g((me) => Behavior.appear(me, 15))
                .duplicate(63)
                .scatter({ p: 120 })
                .delayByIndex()
                .speed(8)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .aim(this.game.player)
                .fire(this.game.bullets)

            yield* Array(120)
        }
    }

    private *cycle3() {
        yield* GenUtils.all({
            icicles: this.cycle3_0(),
            snow: this.cycle3_1(),
        })
        yield
    }

    private *cycle3_0() {
        while (1) {
            yield* remodel(this)
                .color("#39baff")
                .format("diamond")
                .p(this.p.clone())
                .g((me) => Behavior.appear(me, 15))
                .duplicate(7, (me, i) => {
                    me.radian = T * (i / 7)
                    me.speed = 4 + 4 * (i / 7)
                    return me
                })
                .delayByIndex(3)
                .ex(31)
                .g(function* (me) {
                    yield* Behavior.reaccel(me, 30, 30, 60)
                })
                .fire(this.game.bullets)

            yield* Array(240)
        }
    }

    private *cycle3_1() {
        while (1) {
            yield* remodel(this)
                .speed(1)
                .color("#bfe9ff")
                .format("small-ball")
                .duplicate(23, (me) => {
                    me.p = vec(me.game.WIDTH * this.random(), 0)
                    return me
                })
                .scatter({ radian: [0, T / 2] })
                .g(function* (me) {
                    yield* Behavior.reaccel(me, 30, 30, 60, 4)
                })
                .fire(this.game.bullets)

            yield* Array(20)
        }
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () =>
            vec.arg(this.frame / 360 + (T / 3) * index).scale(200 + 50 * Math.sin(this.frame / 720)),
        )
        this.isInvincible = true
    }
}
