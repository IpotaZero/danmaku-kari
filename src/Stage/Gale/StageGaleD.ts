import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { GenUtils } from "@ipota/functions"

// ステージ「アキアカネ」(六日前・風の尾根)
// 夏を山の上で過ごし、秋に里へ下りて卵を産む赤蜻蛉。みんなが山を下りていく中、上っていくのはハチノコだけ
export default class extends Stage {
    *G() {
        yield* this.narrate("六日前。風の尾根。", "赤い蜻蛉の群れが、風に乗って山を下っていく。")

        this.showFigure(Figure.hachinoko)
        this.showFigure(Figure.yukimushi)
        yield* this.talk(
            "ユキムシ",
            "アキアカネだ。夏は山の上で涼んで、秋になったら里へ下りて卵を産むの。",
            "みんな、下りていくね。上っていくのは、キミだけ。",
        )
        yield* this.talk("アキアカネ", "そこの蜜蜂。", "下りる前に、腹ごしらえしたくてね。")
        yield* this.talk("ハチノコ", "スズメバチの巣に行く。どいて。")
        yield* this.talk(
            "アキアカネ",
            "てっぺんの? この秋、あいつらは山じゅうの巣を襲って、子どもを肉にして運んでたよ。",
            "運ばれた子は、もう誰かの腹の中さ。",
        )
        yield* this.talk("ハチノコ", "……どいて。")
        yield* this.talk("アキアカネ", "おまえも、誰かの腹の中に入るんだよ。")
        this.hideAllFigures()

        const boss = new EnemyBoss(this.game)
        const phase1 = new EnemyPhase1(this.game, boss)
        const phase2 = new EnemyPhase2(this.game, boss)
        const phase3 = new EnemyPhase3(this.game, boss)
        this.game.enemies.push(boss, phase1, phase2, phase3)
        yield* this.waitDead([phase1])
        this.scorenizeAllBullets()
        phase2.start()
        yield* this.waitDead([phase2])
        this.scorenizeAllBullets()
        phase3.start()
        yield* this.waitDead([phase3])
        this.scorenizeAllBullets()
        boss.start()
        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure(Figure.hachinoko)
        yield* this.talk("アキアカネ", "……逃げもしない、食われもしない。変な蜂。")
        yield* this.talk("アキアカネ", "腹ぺこのまま、下りるよ。卵、産めるかな。")
        yield* this.narrate("赤い群れは、尾根の向こうに消えた。")
        this.showFigure(Figure.yukimushi)
        yield* this.talk("ユキムシ", "あと六日。")
        this.hideAllFigures()
    }
}

// const loopTime = 680;

class EnemyPhase1 extends Enemy {
    private parent: Enemy
    constructor(game: Game, parent: Enemy) {
        super(game, 1900, 40, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 360).scale(parent.r + this.r * 3))
        this.parent = parent
        this.addScript(() => this.attack(), { loop: Infinity, margin: 60 })
    }

    private *fire() {
        yield* remodel(this)
            .format("big-ball")
            .color("#44aa44")
            .p(this.parent.p)
            .speed(8)
            // .radian(T / 4)
            .nway(16, T / 16)
            .g(function* (me) {
                yield* Behavior.stop(me, 30)
                // yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 64) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 8),
                })
            })
            .fire(this.game.bullets)
    }

    private *fire2() {
        const way = 18
        yield* remodel(this)
            .format("diamond")
            .color("#ffcbaa")
            .speed(4)
            .colorful(Math.random() * 100)
            .duplicate(54, (b, i) => {
                b.p = this.parent.p.add(vec.arg((T / way) * i * 0.9).scale(i ** 1.1 * 3))
                b.radian = (T / way) * i * 0.9 + T / 6
                return b
            })
            .appear(20, 1)
            .g(function* (me) {
                yield* Behavior.stop(me, 60)
                // yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame
                const startRadian = me.radian
                yield* Array(60)
                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 8) * Math.sin((T / 32) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 240, 8),
                })
            })
            .fire(this.game.bullets)
    }

    private *attackTurn() {
        for (let i = 0; i < 4; i++) {
            yield* Array(60)
            yield* this.fire()
            yield* Array(60)
            yield* this.fire2()
        }
        yield* this.fire()
        yield* Array(60)
        yield* this.fire()
        yield* Array(240)
    }

    private *attack(): Generator<void, void, void> {
        yield* GenUtils.all({ attack: this.attackTurn(), wait: Array(780) })
    }
}

class EnemyPhase2 extends Enemy {
    private parent: Enemy
    constructor(game: Game, parent: Enemy) {
        super(game, 1800, 40, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(T / 3 + this.frame / 360).scale(parent.r + this.r * 3))
        this.parent = parent
        this.isInvincible = true
    }

    private *fire(num: number) {
        yield* remodel(this)
            .format("diamond")
            .color("#ffcbaa")
            .p(this.parent.p)
            .speed(4)
            .nway(num, T / num)
            .g(function* (me) {
                yield* Behavior.stop(me, 40)
                // yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 256) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 60, 2),
                })
            })
            .fire(this.game.bullets)
    }

    private *fire2() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffcbaa")
            .p(this.p)
            .speed(2)
            .nway(10, T / 10)
            .appear(20, 2)
            .colorful(Math.random() * 100)
            // .radian(T / 4)
            .g(function* (me) {
                yield* Behavior.stop(me, 30)
                // yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 12) * Math.sin((T / 32) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 2),
                })
            })
            .fire(this.game.bullets)
    }

    private *attackTurn() {
        for (let i = 0; i < 12; i++) {
            yield* Array(30)
            yield* this.fire(12 + i)
            // yield* this.fire2();
        }
        yield* Array(120)
    }

    private *attack(): Generator<void, void, void> {
        yield* GenUtils.all({ attack: this.attackTurn(), wait: Array(720) })
    }

    start() {
        this.isInvincible = false
        this.addScript(() => this.attack(), { loop: Infinity })
    }
}
class EnemyPhase3 extends Enemy {
    constructor(game: Game, parent: Enemy) {
        super(game, 1800, 40, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg((T * 2) / 3 + this.frame / 360).scale(parent.r + this.r * 3))
        this.isInvincible = true
    }

    private *fire() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffcbaa")
            .p(this.p)
            .speed(2)
            .radian(T / 4)
            .g(function* (me) {
                yield* Behavior.stop(me, 30)
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
    }

    private *fire2() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffcbaa")
            .p(this.p)
            .speed(2)
            .nway(10, T / 10)
            .appear(20, 2)
            .colorful(Math.random() * 100)
            // .radian(T / 4)
            .g(function* (me) {
                yield* Behavior.stop(me, 30)
                // yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame
                const startRadian = me.radian

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 32) * (this.frame - startFrame))
                            yield
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 4),
                })
            })
            .fire(this.game.bullets)
    }

    private *attackTurn() {
        for (let i = 0; i < 4; i++) {
            yield* Array(120)
            yield* this.fire()
            yield* this.fire2()
        }
        yield* Array(120)
    }

    private *attack(): Generator<void, void, void> {
        yield* GenUtils.all({ attack: this.attackTurn(), wait: Array(720) })
    }

    start() {
        this.isInvincible = false
        this.addScript(() => this.attack(), { loop: Infinity })
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.2, 5, 5)

    constructor(game: Game) {
        super(game, 1800, 48, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.addScript(() => this.enter())
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4)
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    start() {
        this.isInvincible = false
        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 900).add(this.center())
        yield
    }

    private *attackTurn() {}

    private *attack(): Generator<void, void, void> {
        yield* GenUtils.all({ attack: this.attackTurn(), wait: Array(720) })
    }
}
