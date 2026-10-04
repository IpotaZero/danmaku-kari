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

// ステージ「合わせ鏡」(陽炎道場・高弟)
// 画面を縦と横に二枚の鏡が仕切り、高弟(ボス)は左上に、その幻は右上・左下・右下に映っている。
// 弾はすべて四つに映る。高弟のそばを回る火の粉(衛星)は自機を狙って矢を撃つが、幻の矢は自機を鏡に映した場所を狙う。
// 鏡の線の近くにいると、自機の鏡像が自分のすぐそばにあるので、幻の矢までこちらへ飛んでくる。
// 鏡の線から離れた、四つに仕切られた部屋の真ん中あたりで戦うのがよい。
// 高弟自身は、揺らめきながら広がるゆっくりした輪を放つ。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。2秒ほど休憩が入る
const CYCLE_FRAMES = 420
const COLOR: Color = "#ffb070"
const ARROW_COLOR: Color = "#ffe0b0"

const FLAME_LIFE = 1100

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyFlame(this.game, master))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.18, this.game.HEIGHT * 0.1, 2, 3)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, FLAME_LIFE, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
        this.addScript(() => Mirage.lines(this, Mirage.cross(game)))
        this.addScript(() => Mirage.ghosts(this, Mirage.cross(game)))
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    // 左上の部屋の真ん中
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

            yield* Mirage.reflect(
                remodel(this)
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
                    }),
                Mirage.cross(this.game),
            ).fire(this.game.bullets)

            yield* Array(70)
        }
    }
}

class EnemyFlame extends Enemy {
    constructor(game: Game, parent: Enemy) {
        super(game, FLAME_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 90).scale(70))
        this.addScript(() => Mirage.ghosts(this, Mirage.cross(game)))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 60, loop: Infinity })
    }

    private *cycle() {
        yield* GenUtils.all({
            arrows: this.arrows(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自機を狙って矢を4回続けて撃つ。幻の矢は、自機を鏡に映した場所へ飛ぶ
    private *arrows() {
        yield* Array(140)

        for (let k = 0; k < 4; k++) {
            yield* Mirage.reflect(
                remodel(this)
                    .format("arrow")
                    .color(ARROW_COLOR)
                    .p(this.p.clone())
                    .speed(0.5)
                    .aim(this.game.player.p)
                    .nway(3, T / 30)
                    .g((me) => Behavior.accel(me, 40, 4)),
                Mirage.cross(this.game),
            ).fire(this.game.bullets)

            yield* Array(14)
        }
    }
}
