import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mirage } from "./Mirage"
import { Size } from "../Size"

const ENTRANCE_FRAMES = 150

const DRAW_FRAMES = 60

const CYCLE_FRAMES = 420
const COLOR: Color = "#ffb070"
const ARROW_COLOR: Color = "#ffe0b0"

const FLAME_LIFE = 1600

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyFlame(this.game, master))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.18, this.game.HEIGHT * 0.1, 2, 3)

    readonly mirrors = Mirage.cross(this.game)

    constructor(game: Game) {
        super(game, FLAME_LIFE, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        Mirage.show(this, this.mirrors, DRAW_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity, margin: DRAW_FRAMES + 30 })
    }

    private home() {
        return vec(this.game.WIDTH * 0.27, this.game.HEIGHT * 0.22)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *rings() {
        for (let k = 0; k < 2; k++) {
            const sign = k % 2 === 0 ? 1 : -1

            yield* remodel(this)
                .format("diamond")
                .color(COLOR)
                .p(this.p.clone())
                .speed(1.6)
                .radian(this.random() * T)
                .ex(14)
                .g(function* (me) {
                    const base = me.radian

                    for (let f = 0; ; f++) {
                        me.radian = base + sign * 0.3 * Math.sin(f / 24)
                        yield
                    }
                })
                .mirrorAll(this.mirrors)
                .fire(this.game.bullets)

            yield* Array(70)
        }
    }
}

class EnemyFlame extends Enemy {
    constructor(
        game: Game,
        private readonly parent: EnemyMaster,
    ) {
        super(game, FLAME_LIFE, Size.S)

        this.setParent(parent, () => vec.arg(this.frame / 90).scale(70))

        this.scripts.add(() => Mirage.ghosts(this, parent.mirrors, ENTRANCE_FRAMES + DRAW_FRAMES))

        this.scripts.add(() => this.cycle(), { margin: ENTRANCE_FRAMES + 180, loop: Infinity })
    }

    private *cycle() {
        yield* GenUtils.all({
            arrows: this.arrows(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *arrows() {
        yield* Array(140)

        yield* remodel(this)
            .format("arrow")
            .color(ARROW_COLOR)
            .p(this.p.clone())
            .aim(this.game.player)
            .ex(13)
            .delayByIndex()
            .speed(4)
            .g((me, i) => Behavior.reaccel(me, 40, 40 - i, 40, 2))
            .mirrorAll(this.parent.mirrors)
            .fire(this.game.bullets)
    }
}
