import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { Sand } from "./Sand"

// ステージ「砂時計」(砂塵道場・師範代)
// 画面いっぱいに、弾を並べた大きな砂時計が描かれる。師範代(ボス)は砂時計のくびれに陣取り、そこから砂を真下へ落とし続ける。
// しばらくすると砂時計はゆっくり半回転してひっくり返る。砂時計の線は抜けられないので、線に押されないよう一緒に回る。
// 下のふくらみにいたまま一緒に回ると、ひっくり返ったときには師範代の真上にいて、弾が当たらなくなる。
// 撃ち込みたければ、くびれ(師範代のすぐ横の、自機がやっと通れる隙間)をくぐって下のふくらみへ移る。
// 砂時計の外側(左右のくさび形のところ)へ出てやり過ごすこともできるが、そこにも回る線が来る。
// 師範代のまわりを回る2つの砂粒(衛星)が、ゆっくりした砂を自機へ投げてくる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。砂時計が消えた後、3秒ほど休憩が入る
const CYCLE_FRAMES = Sand.Hourglass.TOTAL_FRAMES + Sand.Hourglass.FADE_FRAMES + 180

const GRAIN_LIFE = 700

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyGrain(this.game, master, 0), new EnemyGrain(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, GRAIN_LIFE * 2, 40, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    // 砂時計のくびれ(画面の真ん中)
    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
    }

    private *cycle() {
        const hourglass = new Sand.Hourglass([0, 1].map(() => (this.random() < 0.5 ? -1 : 1)))

        yield* GenUtils.all({
            hourglass: hourglass.draw(this, this.home()).fire(this.game.bullets),
            pour: hourglass.pour(this),
            wait: Array(CYCLE_FRAMES),
        })
    }
}

class EnemyGrain extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, GRAIN_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 120 + (T / 2) * index).scale(90))

        this.addScript(() => this.cycle(), {
            margin: ENTRANCE_FRAMES + Sand.Hourglass.DRAW_FRAMES + index * 50,
            loop: Infinity,
        })
    }

    // ゆっくりした砂を3粒、自機へ投げる
    private *cycle() {
        yield* remodel(this)
            .format("diamond")
            .color("#fff0c0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(3, T / 18)
            .g((me) => Behavior.accel(me, 60, 2.6))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
