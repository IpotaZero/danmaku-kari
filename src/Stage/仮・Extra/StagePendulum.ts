import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Size } from "../Size"

// ステージ「振り子」(修行場)
// 画面の上の二か所から、弾を連ねた長い鎖の振り子が下がり、大きく揺れて画面の下の方を薙いでいく。
// 鎖は抜けられないが、それぞれ一か所だけ輪が欠けている。欠けた輪は、振り子の支点からいつも同じ距離にある。
// 鎖が来るときに、その鎖の欠けた輪と同じ距離のところにいれば、鎖は自機をすり抜けていく。
// 二本の振り子は揺れる速さが違うので、次にどちらの鎖が来るかを見て、立つ場所を移していく。
// 欠けた輪の場所は、鎖が下りてくる間(提示)に分かる。揺れ終わると鎖は引き上げられ、次は別の場所が欠ける。
// 修行相手はときどき、ゆっくりした輪を放つ。

const ENTRANCE_FRAMES = 150
// 鎖が下りるのにかかる時間・揺れている時間・引き上げられるまで
const LOWER_FRAMES = 60
const SWING_FRAMES = 600
const FADE_FRAMES = 30
// 1周期の長さ。鎖が引き上げられた後、3秒ほど休憩が入る
const CYCLE_FRAMES = LOWER_FRAMES + SWING_FRAMES + FADE_FRAMES + 180
// 鎖の輪の間隔と、欠ける輪の数
const LINK_SPACING = 16
const MISSING = 3
// 鎖の長さ(画面の高さに対する割合)と、揺れの幅
const LENGTH = 0.82
const AMPLITUDE = (T / 360) * 35
// 二本の振り子の一往復にかかる時間。違う速さで揺れるので、だんだんずれていく
const PERIODS = [250, 310]
const COLOR: Color = "#e8d0ff"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyMaster(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.03, 1, 2)

    constructor(game: Game) {
        super(game, 3000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        const width = this.game.WIDTH

        yield* GenUtils.all({
            left: this.pendulum(vec(width * 0.25, 0), PERIODS[0], -1),
            right: this.pendulum(vec(width * 0.75, 0), PERIODS[1], 1),
            rings: (function* (me: EnemyMaster) {
                for (let k = 0; k < 3; k++) {
                    yield* Array(LOWER_FRAMES + 150)

                    yield* remodel(me)
                        .format("donut")
                        .color("#ffffff")
                        .p(me.p.clone())
                        .speed(1.3)
                        .radian(me.random() * T)
                        .ex(14)
                        .g((b) => Behavior.appear(b, 20))
                        .fire(me.game.bullets)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // pivot から鎖を下ろし、side の側へ振り上げたところから揺らす。鎖の途中の一か所だけ輪を欠く
    private *pendulum(pivot: Vec, period: number, side: number) {
        const length = this.game.HEIGHT * LENGTH
        const links = Math.floor(length / LINK_SPACING)
        // 欠ける輪は、自機がいそうな画面の下半分のどこか
        const missing = Math.floor(links * (0.5 + 0.35 * this.random()))
        const distances = Array.from({ length: links }, (_, i) => (i + 1) * LINK_SPACING).filter(
            (_, i) => i < missing || missing + MISSING <= i,
        )
        const angle = (f: number) => side * AMPLITUDE * Math.cos((T * f) / period)
        const at = (d: number, f: number) => pivot.add(vec.arg(T / 4 + angle(f)).scale(d))

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color(COLOR)
            .speed(0)
            .duplicate(distances.length + 1, (b, i) => {
                // 最後の一つは鎖の先の重り
                if (i === distances.length) b.r = 24
                b.p = pivot.clone()
                return b
            })
            .unbounded()
            .g(function* (me, i) {
                const d = i < distances.length ? distances[i] : length + 16

                // 鎖を真っすぐ下ろしてから、揺らし始める位置まで振り上げる。この間は薄く、当たり判定がない
                me.type = "neutral"
                me.alpha = 0.3

                for (let f = 1; f <= LOWER_FRAMES; f++) {
                    const t = f / LOWER_FRAMES
                    me.p = pivot.add(vec.arg(T / 4 + angle(0) * t).scale(d * Math.min(1, t * 1.5)))
                    yield
                }

                me.type = "enemy"
                me.alpha = 1

                for (let f = 0; f < SWING_FRAMES; f++) {
                    me.p = at(d, f)
                    yield
                }

                yield* Behavior.fadeout(me, FADE_FRAMES)
            })
            .fire(this.game.bullets)
    }
}
