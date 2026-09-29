import { vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { Remodel, remodel } from "../Game/Remodel"
import { Stage } from "./Stage"
import { EnemyRendererCore } from "../Game/Actor/EnemyRendererCore"
import { T } from "../T"
import { GenUtils } from "../utils/Functions/GeneratorUtils"
import { Curves } from "../utils/Functions/Curves"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"

// ボスの登場演出にかかるフレーム数。衛星もこれだけ待ってから合わせて動き出す
const ENTRANCE_FRAMES = 150
// 一斉射撃の後の休憩フレーム数。ボスと衛星の両方がこの数値だけ待つことで、
// お互いを一切参照せずとも常に同じフレームで発射できる
const REST_FRAMES = 240

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["雪の降り積もる朝。<br>道場に甲高い声が響き渡る。"])

        this.showFigure("hachinoko", "assets/figure/Hachinoko.apng", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やいやいお前らっ! 私と勝負するんだなっ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["なんだお前!?"], { name: "道場の人間" })
        yield* this.game.textBox.say(["道場破りだぁっ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")

        if (isSmartPhone) {
            yield* this.game.textBox.say(["スワイプで移動"])
        } else {
            yield* this.game.textBox.say(["矢印キーで移動。Shiftキーで低速。"])
        }

        const parent = new EnemyBoss(this.game)
        this.game.enemies.push(parent)

        const satelliteCount = 3
        for (let i = 0; i < satelliteCount; i++) {
            this.game.enemies.push(new EnemySatellite(this.game, parent, i, satelliteCount))
        }

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.4, 3, 4)

    constructor(game: Game) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 900).add(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4))
        yield
    }

    // 「弾を並べて溜める(提示) → 一斉に加速して襲いかかる → 何もない静寂」を1セットとする
    private *attack() {
        yield* GenUtils.all({
            attack: this.radialVolley(),
            wait: Array(REST_FRAMES),
        })
    }

    // ボスの全方位に近い扇
    // reaccelで一旦飛び出してから減速・静止・再加速させることで、出現位置の一点に重ならず放射状に広がる
    private *radialVolley() {
        const stopFrames = 40
        const waitFrames = 20
        const accelFrames = 60
        const launchSpeed = 6

        // delayByIndexを使うことでリボンスプレッドのような効果を生み出すことができる。

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("ball")
            .r(4)
            .speed(8)
            .color("#ffffff")
            .aim(this.game.player.p.clone())
            .nway(13, T / 120)
            .delayByIndex()
            .g(function* (me, i) {
                yield* Remodel.reaccel(me, stopFrames, waitFrames - i, accelFrames, launchSpeed)
            })
            .fire(this.game.bullets)
    }
}

class EnemySatellite extends Enemy {
    constructor(
        game: Game,
        private readonly parent: Enemy,
        index: number,
        count: number,
    ) {
        super(game, 500, 20)

        // 公転半径を大きくすることで、異なる方向からの攻撃を見せることができる。
        // 異なる方向からの攻撃を実現するためには横幅が必要である。
        // 極論、砲塔以外から攻撃してもよいのだ。
        const phase = (T * index) / count
        const orbitSpeed = T / 2400
        const radius = 250

        this.setParent(parent, () => vec.arg(phase + this.frame * orbitSpeed).scale(radius))

        this.addScript(() => this.attack(), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    // ボスを一切見ず、ボスと全く同じフレーム数だけ待つことで結果的に同時発射になる
    private *attack() {
        yield* GenUtils.all({
            attack: this.fireAimed(5, T / 16, 10, 6),
            wait: Array(REST_FRAMES),
        })

        yield* GenUtils.all({
            attack: this.fireAimed(3, T / 14, 10, 6),
            wait: Array(REST_FRAMES),
        })
    }

    private *fireAimed(nway: number, angle: number, waitFrames: number, launchSpeed: number) {
        if (this.life <= 0) return

        const stopFrames = 40
        const accelFrames = 60
        const target = this.game.player.p.clone()

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("donut")
            .r(12)
            .speed(6)
            .color("#ff3366")
            .aim(target)
            .nway(nway, angle)
            .delayByIndex()
            .g(function* (me, i) {
                yield* Remodel.reaccel(me, stopFrames, waitFrames - i, accelFrames, launchSpeed)
            })
            .fire(this.game.bullets)
    }
}
