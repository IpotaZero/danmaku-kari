import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Shadow } from "./Shadow"

// ステージ「影踏み」(月影道場・門下生)
// 門下生が自機の影を踏みにくる。影(薄い丸)は自機の少し後ろを、自機の通った道筋どおりについてきて、足跡を残していく。
// 足跡は実体の弾で、しばらく残る。立ち止まると影に追いつかれて足跡を踏まれるので、動き続けなければならない。
// 速く動けば足跡はまばらで(すき間を抜けられる)、ゆっくり動けば足跡は詰まって壁になる。
// 左右の影法師(衛星)がゆっくりした輪を放ち、動ける場所を狭めてくる。自分の足跡に囲まれないよう、輪のすき間へ逃げる道を残しておく。

const ENTRANCE_FRAMES = 150
const SHADOW: Shadow.Config = { delay: 45, stepInterval: 5, stepLife: 150, frames: 330, color: "#b8a8ff" }
// 1周期の長さ。足跡が消えた後、2秒ほど休憩が入る
const CYCLE_FRAMES = SHADOW.frames + SHADOW.stepLife + 140

const FOLLOWER_LIFE = 700

export default class extends Stage {
    *G() {
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, new EnemyFollower(this.game, pupil, -1), new EnemyFollower(this.game, pupil, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, FOLLOWER_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            shadow: Shadow.follow(this, SHADOW),
            wait: Array(CYCLE_FRAMES),
        })
    }
}

class EnemyFollower extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, FOLLOWER_LIFE, 24)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.3, game.HEIGHT * 0.04 * Math.sin(this.frame / 90)))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 60 + (side > 0 ? 60 : 0), loop: Infinity })
    }

    // ゆっくりした輪
    private *cycle() {
        yield* remodel(this)
            .format("donut")
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(1.4)
            .radian(this.random() * T)
            .ex(16)
            .g((me) => Behavior.appear(me, 20))
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
