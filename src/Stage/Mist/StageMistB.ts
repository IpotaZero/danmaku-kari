import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
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
// 石が霧の姿で現れてから、入れ替わりが始まるまで
const INTRO_FRAMES = 70
// 入れ替わりを続ける時間(時計の3周分)
const CLOCK = new Mist.Clock(140, 30)
const ACTIVE_FRAMES = CLOCK.period * 3
const FADE_FRAMES = 30
// 1周期の長さ。石が消えた後、3秒ほど休憩が入る
const CYCLE_FRAMES = INTRO_FRAMES + ACTIVE_FRAMES + FADE_FRAMES + 180
// 石の間隔と、石を敷く範囲の上端。石の半径は24なので、四つの石に囲まれた真ん中にしか常に安全な場所はない
const STONE_SPACING = 44
const FIELD_TOP = 0.34
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

    // 市松模様に石を敷く。(列+行)の偶奇で組を分ける
    private *stones() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const offset = vec(this.random() * STONE_SPACING, height * FIELD_TOP + this.random() * STONE_SPACING)
        const columns = Math.ceil((width - offset.x) / STONE_SPACING)
        const rows = Math.ceil((height - offset.y) / STONE_SPACING)

        yield* remodel(this)
            .format("big-ball")
            .speed(0)
            .type("neutral")
            .alpha(0.15)
            .duplicate(columns * rows, (b, i) => {
                const column = i % columns
                const row = Math.floor(i / columns)
                b.p = offset.add(vec(column, row).scale(STONE_SPACING))
                b.color = COLORS[(column + row) % 2]
                return b
            })
            .g(function* (me, i) {
                const phase = ((i % columns) + Math.floor(i / columns)) % 2

                yield* GenUtils.all({
                    appear: Behavior.appear(me, INTRO_FRAMES),
                    clock: (function* () {
                        for (let t = -INTRO_FRAMES; t < ACTIVE_FRAMES; t++) {
                            CLOCK.apply(me, phase, t)
                            yield
                        }
                    })(),
                })

                yield* Behavior.fadeout(me, FADE_FRAMES)
            })
            .fire(this.game.bullets)
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
        yield* Array(INTRO_FRAMES + (side > 0 ? 35 : 0))

        for (let t = 0; t < ACTIVE_FRAMES - 70; t += 70) {
            if (this.life <= 0) return

            yield* remodel(this)
                .format("arrow")
                .r(16)
                .color("#ffe0a0")
                .p(this.p.clone())
                .speed(2.8)
                .aim(this.game.player.p)
                .nway(3, T / 24)
                .fire(this.game.bullets)

            yield* Array(70)
        }
    }
}
