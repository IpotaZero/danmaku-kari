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

// ステージ「波紋」(修行場)
// 修行相手が水面へしずくを投げる。しずくは薄く(当たり判定なし)飛んでいき、落ちた場所から三重の波紋が広がる。
// 波紋は弾を輪に並べたもので、落ちた場所の近くでは弾が詰まって抜けられないが、広がるほど弾の間がひらき、やがて薄れて消える。
// しずくの落ちる場所はしずくが飛んでいる間に分かるので、落ちる場所から離れ、広がってまばらになった波紋をくぐる。
// しずくはあちこちに時間差で落ち、いくつもの波紋が重なり合う。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。最後の波紋が消えた後、2秒ほど休憩が入る
const CYCLE_FRAMES = 520
// 1周期に投げるしずくの数と間隔
const DROPS = 5
const DROP_INTERVAL = 32
// しずくが飛んでいる時間(提示)
const FLIGHT_FRAMES = 50
// 波紋の重なりの数・間隔と、一つの輪の弾の数・広がる速さ・消え始めるまでの時間
const RIPPLES = 3
const RIPPLE_INTERVAL = 16
const RIPPLE_COUNT = 40
const RIPPLE_SPEED = 1.6
const RIPPLE_LIFE = 140
// しずくを自機からどれだけ離して落とすか
const LAND_MIN = 70
const LAND_MAX = 240
const COLOR: Color = "#a8e0ff"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyMaster(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.05, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            drops: (function* (me: EnemyMaster) {
                for (let k = 0; k < DROPS; k++) {
                    yield* me.drop(me.landing())
                    yield* Array(DROP_INTERVAL)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自機から少し離れた、画面の中の場所
    private landing(): Vec {
        const p = this.game.player.p.add(
            vec.arg(this.random() * T).scale(LAND_MIN + this.random() * (LAND_MAX - LAND_MIN)),
        )
        return vec(
            Math.min(Math.max(p.x, 20), this.game.WIDTH - 20),
            Math.min(Math.max(p.y, this.game.HEIGHT * 0.3), this.game.HEIGHT - 20),
        )
    }

    // しずくを投げ、落ちた場所から三重の波紋を広げる
    private *drop(target: Vec) {
        const game = this.game

        yield* remodel(this)
            .format("small-ball")
            .r(7)
            .color(COLOR)
            .type("neutral")
            .alpha(0.3)
            .isScorable(false)
            .p(this.p.clone())
            .g(function* (me) {
                yield* Behavior.throwTo(me, target, FLIGHT_FRAMES)

                for (let k = 0; k < RIPPLES; k++) {
                    yield* remodel(this)
                        .format("small-ball")
                        .color(COLOR)
                        .p(target.clone())
                        .speed(RIPPLE_SPEED)
                        .radian(this.random() * T)
                        .ex(RIPPLE_COUNT)
                        .g(function* (b) {
                            yield* Array(RIPPLE_LIFE)
                            yield* Behavior.fadeout(b, 40)
                        })
                        .fire(game.bullets)

                    yield* Array(RIPPLE_INTERVAL)
                }

                me.life = 0
            })
            .fire(game.bullets)
    }
}
