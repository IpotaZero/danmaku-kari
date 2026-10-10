import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Sand } from "./Sand"
import { Size } from "../Size"

// ステージ「蟻地獄」(砂塵道場・高弟)
// 高弟(ボス)は蟻地獄の巣の底にいて、ときどき自機を巣の底へ吸い寄せる。
// 吸い込みが始まる前には、砂粒(当たり判定なし)が渦を巻いて底へ流れ込み始めるので、それが提示になる。
// 吸い込まれている間は、立ち止まっているだけで底へ引きずられる。底へ近いほど弾が濃いので、ずっと逆らって動き続ける。
// 高弟は吸い込みの間、自機へ向けて砂をかける(扇形に広がる、速さのばらばらな砂粒)。
// 巣の縁を2匹の蟻(衛星)が回っていて、歩いた跡に砂粒を落とす。落ちた砂粒は少しして巣の底へ滑り落ちていく。
// 吸い込みが止んでいる間が休憩。

const ENTRANCE_FRAMES = 150
// 1周期の長さと、その中での吸い込みの始まり・終わり
const CYCLE_FRAMES = 600
const SWIRL_FRAMES = 70
const SUCTION_FRAMES = 300
// 吸い込みの強さ(1フレームあたりに引きずられる距離)。低速移動(3)なら逆らえる
const SUCTION = 1.1
// 巣の縁の半径(蟻が回る半径)
const RIM = 190
// 蟻が砂粒を落とす間隔と、落ちた砂粒が滑り落ち始めるまで
const DROP_INTERVAL = 7
const DROP_REST = 40

const ANT_LIFE = 600

export default class extends Stage {
    *G() {
        const antlion = new EnemyAntlion(this.game)
        this.game.enemies.push(antlion, new EnemyAnt(this.game, antlion, 0), new EnemyAnt(this.game, antlion, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyAntlion extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, ANT_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            swirl: this.swirl(),
            suction: this.suction(),
            sand: this.throwSand(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 吸い込みの間ずっと、自機を巣の底へ引きずる
    private *suction() {
        yield* Array(SWIRL_FRAMES)
        yield* Sand.suction(this, SUCTION, SUCTION_FRAMES)
    }

    // 砂粒(当たり判定なし)が渦を巻いて巣の底へ流れ込む。吸い込みが始まる少し前から、終わるまで続く
    private *swirl() {
        yield* Sand.swirl(this, SWIRL_FRAMES + SUCTION_FRAMES).fire(this.game.bullets)
    }

    // 吸い込みの間、自機へ向けて扇形に砂をかける
    private *throwSand() {
        yield* Array(SWIRL_FRAMES + 30)

        for (let k = 0; k < 5; k++) {
            yield* Sand.throwSand(this, 54).fire(this.game.bullets)
            yield* Array(55)
        }
    }
}

class EnemyAnt extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, ANT_LIFE, Size.S)

        this.setParent(parent, () => vec.arg(this.frame / 160 + (T / 2) * index).scale(RIM))

        this.scripts.add(() => this.cycle(parent), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(pit: Enemy) {
        yield* GenUtils.all({
            trail: this.trail(pit),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 歩いた跡に砂粒を落とす。砂粒は少し留まってから、巣の底へ向かって滑り落ちていく
    private *trail(pit: Enemy) {
        yield* Array(SWIRL_FRAMES)

        for (let i = 0; i < SUCTION_FRAMES; i += DROP_INTERVAL) {
            if (this.life <= 0) return

            yield* remodel(this)
                .format("small-ball")
                .color(Sand.COLOR)
                .p(this.p.clone())
                .speed(0)
                .appear(10)
                .g(function* (me) {
                    yield* Array(DROP_REST)

                    // 巣の底へ向かってだんだん速く滑り落ち、底に着いたら消える
                    for (let diff = pit.p.sub(me.p); diff.magnitude() > 24; diff = pit.p.sub(me.p)) {
                        me.radian = diff.radian()
                        me.speed = Math.min(me.speed + 0.04, 3)
                        yield
                    }

                    me.life = 0
                })
                .fire(this.game.bullets)

            yield* Array(DROP_INTERVAL)
        }
    }
}
