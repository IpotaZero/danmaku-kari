import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyCore(this.game))
        yield* this.waitAllEnemiesDead()
    }
}

class EnemyCore extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 5, 6)
    private side: boolean = true

    constructor(game: Game) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4)
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.attack(), { loop: Infinity })
        this.addScript(() => this.attack2(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 900).add(this.center())
        yield
    }

    private *attack() {
        yield* Array(80)
        yield* remodel(this)
            .format("diamond")
            .r(20)
            .aim(this.game.player.p)
            .color("#bbffaa")
            .speed(8)
            .p(this.p)
            .nway(8, T / 16)
            .g(function* (me) {
                yield* Behavior.stop(me, 20)
                yield* Behavior.aim(me, this.game.player.p, 30)
                const startFrame = this.frame
                const startRadian = me.radian
                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 8) * Math.sin((T / 64) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 6),
                })
            })
            .fire(this.game.bullets)
    }
    private *attack2() {
        yield* Array(100)
        yield* remodel(this)
            .format("donut")
            .radian(20)
            .color("#aaaa44")
            .speed(3)
            .duplicate(8, (b, i) => {
                b.p = vec((this.side ? this.game.WIDTH / 2 : 0) + (this.game.WIDTH / (2 * 7)) * i, 0)
                if (i == 7) {
                    this.side = !this.side
                }
                return b
            })
            .radian(T / 4)
            .fire(this.game.bullets)
    }
}
