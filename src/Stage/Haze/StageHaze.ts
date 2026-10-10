import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Mirage } from "./Mirage"
import { Heat } from "./Heat"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#ffb070"
const ARROW_COLOR: Color = "#ffe0b0"

const CYCLE0_FRAMES = 460

const DRAW_FRAMES = 50
const TILT_MIN = T / 60
const TILT_MAX = T / 15

const TURN_WAIT = 60
const TURN_FRAMES = 640
const CYCLE2_FRAMES = Heat.PLUME_TOTAL_FRAMES + 360
const CYCLE3_FRAMES = Heat.PLUME_TOTAL_FRAMES + 300

export default class extends Stage {
    *G() {
        const boss = new EnemyHaze(this.game)
        const cores = [0, 1, 2].map((i) => new EnemyCore(this.game, boss, i))

        this.game.enemies.push(boss, ...cores)
        cores[0].isInvincible = false

        const phase = boss.start()
        phase.next()

        for (let i = 0; i < cores.length; i++) {
            yield* this.waitDead([cores[i]])

            if (i + 1 < cores.length) {
                cores[i + 1].isInvincible = false
            } else {
                boss.isInvincible = false
            }

            phase.next()
            this.scorenizeAllBullets()
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyHaze extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.05, 1, 2)

    private mirrors: readonly Mirage.Mirror[] = []

    constructor(game: Game) {
        super(game, 3600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
    }

    *start() {
        this.scripts.add(() => this.cycle0(), { id: "cycle", margin: 150 })
        yield

        this.reflectIn([], DRAW_FRAMES)
        this.scripts.add(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 300 })
        this.scripts.add(() => this.reflectInLater(() => [Mirage.horizontal(this.game)]))
        yield

        this.reflectIn([], DRAW_FRAMES)
        this.scripts.add(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 300 })
        yield

        this.reflectIn([], DRAW_FRAMES)
        this.scripts.add(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 300 })
        this.scripts.add(() => this.reflectInLater(() => Mirage.cross(this.game)))

        yield
    }

    private *reflectInLater(mirrors: () => readonly Mirage.Mirror[]) {
        yield* Array(240)
        this.reflectIn(mirrors(), DRAW_FRAMES)
    }

    private reflectIn(mirrors: readonly Mirage.Mirror[], drawFrames: number) {
        this.mirrors.forEach((m) => m.remove())
        this.mirrors = mirrors
        Mirage.show(this, mirrors, drawFrames)
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 300).add(this.home())
        yield
    }

    private ring(count: number, sign: number) {
        return remodel(this)
            .format("diamond")
            .color(COLOR)
            .p(this.p.clone())
            .speed(1.7)
            .radian(this.random() * T)
            .ex(count)
            .g(function* (me) {
                const base = me.radian

                for (let f = 0; ; f++) {
                    me.radian = base + sign * 0.35 * Math.sin(f / 20)
                    yield
                }
            })
    }

    private arrows(way: number) {
        return remodel(this)
            .format("arrow")
            .color(ARROW_COLOR)
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(way, T / 24)
            .g((me) => Behavior.accel(me, 50, 3.6))
    }

    private *cycle0() {
        for (let side = this.random() < 0.5 ? -1 : 1; ; side *= -1) {
            const mirrors = [
                new Mirage.Mirror(
                    vec(this.game.WIDTH / 2, this.game.HEIGHT / 2),
                    side * (TILT_MIN + this.random() * (TILT_MAX - TILT_MIN)),
                ),
            ]

            this.reflectIn(mirrors, DRAW_FRAMES)

            yield* Array(DRAW_FRAMES + 60)

            for (let k = 0; k < 3; k++) {
                yield* this.ring(22, k % 2 === 0 ? 1 : -1)
                    .mirrorAll(mirrors)
                    .fire(this.game.bullets)
                yield* Array(40)
            }

            yield* Array(CYCLE0_FRAMES - DRAW_FRAMES - 20 - 60)
        }
    }

    private *cycle1() {
        const mirrors = this.mirrors
        const turn = this.random() < 0.5 ? -1 : 1

        yield* Array(60)

        yield* remodel(this)
            .format("diamond")
            .color(COLOR)
            .p(this.p.clone())
            .radian(this.random() * T)
            .ex(19)
            .g(function* (me) {
                const base = me.radian

                for (let f = 0; ; f++) {
                    me.radian = base + turn * 0.2 * Math.sin(f / 30)
                    yield
                }
            })
            .sim(2, 0.5, 1)
            .mirrorAll(mirrors)
            .fire(this.game.bullets)
        yield* Array(TURN_WAIT)

        const starts = mirrors.map((m) => m.angle)

        for (let f = 1; f <= TURN_FRAMES; f++) {
            mirrors.forEach((m, i) => {
                const direction = turn
                m.angle = starts[i] + direction * (T / 4) * Ease.InOut(f / TURN_FRAMES)
            })
            yield
        }

        yield* Array(120)
    }

    private *cycle2() {
        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .sim(31, 3, 6)
            .delayByIndex(10)
            .color(COLOR)
            .ex(23)
            .bounce(1)
            .g(function* (me, i) {
                yield* Behavior.rotating(me, (T / 3600) * ((i % 2) * 2 - 1), 120)
            })
            .fire(this.game.bullets)
        yield* Array(360)
    }

    private *cycle3() {
        const mirrors = this.mirrors

        yield* GenUtils.all({
            plumes: Heat.plumes(this, 4, mirrors),
            arrows: (function* (me: EnemyHaze) {
                yield* Array(Heat.SEED_FRAMES + 60)

                for (let k = 0; k < 3; k++) {
                    yield* me.arrows(3).mirrorAll(mirrors).fire(me.game.bullets)
                    yield* Array(50)
                }
            })(this),
            wait: Array(CYCLE3_FRAMES),
        })
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(150))
        this.isInvincible = true
    }
}
