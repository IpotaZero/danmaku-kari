import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mist } from "./Mist"

// ステージ「飛び石」(霧隠道場・高弟)
// 画面の下半分に、大きな弾が市松模様に敷き詰められる。白と黒の石は時計に合わせて交互に霧になる。
// 実体の石のすき間は霧の石の上にしかないので、入れ替わるたびに隣の石へ飛び移ることになる。
// 石は霧の姿で現れてから動き出すので、それが提示になる。並びは周期ごとにずれる。
// 左右の忍び(衛星)が、霧にならない苦無を投げてくる。苦無をよけようとして実体の石に触れないよう、飛び移る先を選ぶ。

const ENTRANCE_FRAMES = 150
const CLOCK = new Mist.Clock(360, 60)
// 石は霧の姿で現れて70フレーム後に入れ替わり始め、時計の3周分続ける。
// 石の半径は24なので、四つの石に囲まれた真ん中にしか常に安全な場所はない
const FIELD: Mist.Field = { spacing: 44, top: 0.34, intro: 70, active: CLOCK.period * 3, fade: 30 }
// 1周期の長さ。石が消えた後、3秒ほど休憩が入る
const CYCLE_FRAMES = FIELD.intro + FIELD.active + FIELD.fade + 180
const COLORS: Color[] = ["#f0f0ff", "#8080a0"]

const SHINOBI_LIFE = 700

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyShinobi(this.game, master, -1), new EnemyShinobi(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, SHINOBI_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            stones: this.stones(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *stones() {
        yield* Mist.stones(
            remodel(this),
            this.game,
            CLOCK,
            FIELD,
            vec(this.random(), this.random()).scale(FIELD.spacing),
            COLORS,
        ).fire(this.game.bullets)
    }
}

class EnemyShinobi extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, SHINOBI_LIFE, 24)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.05 * Math.sin(this.frame / 100)))

        this.addScript(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            kunai: this.kunai(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 入れ替わりが続いている間、苦無を三本ずつ投げる。左右の忍びで投げる時刻をずらす
    private *kunai(side: number) {
        yield* Array(FIELD.intro + (side > 0 ? 35 : 0))

        for (let t = 0; t < FIELD.active - 70; t += 70) {
            if (this.life <= 0) return

            yield* remodel(this)
                .format("diamond")
                .r(16)
                .color("#ffe0a0")
                .p(this.p.clone())
                .speed(2.8)
                .aim(this.game.player)
                .nway(3, T / 24)
                .fire(this.game.bullets)

            yield* Array(70)
        }
    }
}
