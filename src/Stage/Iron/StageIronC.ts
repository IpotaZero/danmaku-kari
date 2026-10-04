import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Shield } from "./Shield"

// ステージ「亀甲」(鉄壁道場・師範代)
// 師範代(ボス)は、弾を蜂の巣のように並べた甲羅にこもっている。甲羅は自機の弾を受け止めるが、撃ち続けると一枚ずつ砕ける。
// 一か所に撃ち込み続けて穴を開ければ、そこから師範代に弾が届く。
// しばらくすると甲羅は弾け飛び、砕け残った甲羅の破片がすべて外へ向かって飛んでくる。たくさん砕いておくほど破片は少ない。
// 弾け飛ぶ前には甲羅が明滅するので、それが提示になる。弾け飛んだ後、新しい甲羅をまとい直す。
// 甲羅の外を回る2匹の子亀(衛星)が、ゆっくりした弾を自機へ投げてくる。

const ENTRANCE_FRAMES = 150
// 甲羅をまとうのにかかる時間・甲羅でいる時間・明滅する時間
const FORM_FRAMES = 40
const HOLD_FRAMES = 460
const WARN_FRAMES = 50
// 1周期の長さ。破片が飛び去った後、2秒ほど休憩が入る
const CYCLE_FRAMES = FORM_FRAMES + HOLD_FRAMES + WARN_FRAMES + 180
// 甲羅の弾の間隔と、甲羅の内側・外側の半径
const SHELL_SPACING = 22
const SHELL_INNER = 46
const SHELL_OUTER = 118
// 甲羅の一枚が砕けるまでに受け止める威力
const DURABILITY = 10
// 1フレームあたりの甲羅の回転
const SHELL_SPIN = T / 900
// 破片が飛ぶ速さ
const SHARD_SPEED = 2.6

const TURTLE_LIFE = 600

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyTurtle(this.game, master, 0), new EnemyTurtle(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

namespace Tortoise {
    // 中心から見た、甲羅の弾の位置。蜂の巣(六角格子)の点のうち、内側と外側の半径の間にあるもの
    export function shell(): Vec[] {
        const a = vec(SHELL_SPACING, 0)
        const b = vec(SHELL_SPACING / 2, (SHELL_SPACING * Math.sqrt(3)) / 2)
        const n = Math.ceil(SHELL_OUTER / SHELL_SPACING) + 1
        const result: Vec[] = []

        for (let i = -n; i <= n; i++) {
            for (let j = -n; j <= n; j++) {
                const p = a.scale(i).add(b.scale(j))
                const d = p.magnitude()
                if (SHELL_INNER < d && d < SHELL_OUTER) result.push(p)
            }
        }

        return result
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, TURTLE_LIFE * 2, 36, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.22)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            shell: this.shell(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 甲羅をまとう。甲羅は師範代について回りながら自機の弾を受け止め、時間が来ると砕け残った破片が外へ飛ぶ
    private *shell() {
        const master = this
        const offsets = Tortoise.shell()
        const base = this.random() * T

        yield* remodel(this)
            .format("small-ball")
            .r(8)
            .color(Shield.COLOR)
            .speed(0)
            .duplicate(offsets.length)
            .g(function* (me, i) {
                const at = (f: number) => master.p.add(offsets[i].rotate(base + SHELL_SPIN * f))
                me.p = at(0)

                const result = yield* GenUtils.race({
                    shield: Shield.breakable(me, DURABILITY),
                    hold: (function* () {
                        for (let f = 0; f < FORM_FRAMES + HOLD_FRAMES + WARN_FRAMES && master.life > 0; f++) {
                            me.p = at(f)

                            // 弾け飛ぶ前の明滅
                            if (f >= FORM_FRAMES + HOLD_FRAMES) {
                                me.alpha = Math.floor(f / 5) % 2 === 0 ? 1 : 0.5
                            }

                            yield
                        }
                    })(),
                })

                if (result.key === "shield" || me.life <= 0) return

                me.alpha = 1
                me.radian = me.p.sub(master.p).radian()
                yield* Behavior.accel(me, 40, SHARD_SPEED)
            })
            .appear(FORM_FRAMES)
            .fire(this.game.bullets)
    }
}

class EnemyTurtle extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, TURTLE_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 150 + (T / 2) * index).scale(170))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 90 + index * 55, loop: Infinity })
    }

    // ゆっくりした弾を3つ、自機へ投げる
    private *cycle() {
        yield* remodel(this)
            .format("donut")
            .color("#a8e8b0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(3, T / 18)
            .g((me) => Behavior.accel(me, 60, 2.6))
            .fire(this.game.bullets)

        yield* Array(110)
    }
}
