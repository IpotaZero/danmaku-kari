import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const parent = new EnemyCore(this.game)
        this.game.enemies.push(parent, new EnemyAim(this.game, parent, T / 2), new EnemyAim(this.game, parent, 0))
        yield* this.waitAllEnemiesDead()
    }
}

class EnemyAim extends Enemy {
    constructor(game: Game, parent: Enemy, radian: number) {
        super(game, 750, Size.S)
        this.setParent(parent, () => vec.arg(radian).scale(parent.r + this.r))
        this.scripts.add(() => this.attack(), { loop: Infinity, margin: 120 })
    }

    private *attack() {
        yield* Array(120)
        yield* remodel(this)
            .format("arrow")
            .color("#ffcbaa")
            .p(this.p)
            .speed(4)
            .radian(T / 4)
            .nway(3, T / 8)
            .g(function* (me) {
                yield* Behavior.stop(me, 20)
                yield* Behavior.aim(me, this.game.player.p, 30)
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 32) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 8),
                })
            })
            .fire(this.game.bullets)
        yield
    }
}

class EnemyCore extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 5, 6)
    private count: number = 0

    constructor(game: Game) {
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })
        this.scripts.add(() => this.enter())
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4)
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.attack(), { loop: Infinity })
        // this.scripts.add(() => this.attack2(), { loop: Infinity });
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 900).add(this.center())
        yield
    }

    private *fire() {
        yield* remodel(this)
            .format("diamond")
            .radian(40)
            .color("#bbffaa")
            .speed(4)
            .duplicate(5, (b, i) => {
                b.p = vec(this.game.WIDTH / 2 + (this.game.WIDTH / 8) * (5 / 2 - i), 15)
                if (i == 4) {
                    this.count++
                }
                return b
            })
            .scatter({ p: 15 })
            .g(function* (me) {
                yield* GenUtils.all({
                    appear: Behavior.appear(me, 30),
                    stop: Behavior.stop(me, 1),
                })
                yield* Behavior.aim(me, vec(this.game.player.p.x, this.game.HEIGHT * 2), 1)
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 4) * Math.sin((T / 64) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 240, 8),
                })
            })
            .fire(this.game.bullets)
    }

    private *fire2() {
        yield* remodel(this)
            .format("diamond")
            .radian(20)
            .color("#aaaa44")
            .speed(4)
            .duplicate(10, (b, i) => {
                b.p = vec(((this.game.WIDTH - 10) / 9) * i + 5 + 10 * (Math.random() - 0.5), 0)
                return b
            })
            .g(function* (me) {
                yield* Behavior.stop(me, 20)
                yield* Behavior.aim(me, this.game.player.p, 1)
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 64) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 4),
                })
            })
            .scatter({ radian: [T / 2, (T * 3) / 2] })
            .fire(this.game.bullets)
    }

    private *attack() {
        yield* Array(40)
        if (this.count == 5) {
            yield* Array(360)
            this.count = 0
        }
        if (this.count % 2 == 0) {
            yield* GenUtils.all({ fire: this.fire(), fire2: this.fire2() })
        } else {
            yield* this.fire()
        }
    }
}
