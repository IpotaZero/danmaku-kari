import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Phase } from "./Phase"
import { Size } from "../Size"

// ステージ「満ち欠け」(月影道場・高弟)
// 高弟(月)が輪を次々に広げる。輪は月のように一部だけが照らされていて、照らされた弧だけが実体、影の側は薄く当たり判定がない。
// 輪を出すたびに月が満ちていき、照らされた弧は三日月から半月、満月へと太り、また痩せていく。照らされる向きも少しずつ回る。
// 影の側へ回り込めば素通りできるが、満月に近づくほど影は細くなる。満月の輪は全部が実体なので、輪の弾のすき間を抜ける。
// 新月のあたりで一息つける。左右の星(衛星)がゆっくりした矢を投げてくる。

const ENTRANCE_FRAMES = 150
// 一巡(新月→満月→新月)に広げる輪の数と間隔
const RINGS = 9
const RING_INTERVAL = 30
// 1周期の長さ。最後の輪が広がった後、3秒ほど休憩が入る
const CYCLE_FRAMES = RINGS * RING_INTERVAL + 200
const RING: Phase.Ring = { count: 36, speed: 3, color: "#fff2c0" }

const STAR_LIFE = 700

export default class extends Stage {
    *G() {
        const moon = new EnemyMoon(this.game)
        this.game.enemies.push(moon, new EnemyStar(this.game, moon, -1), new EnemyStar(this.game, moon, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMoon extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, STAR_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 輪を出すたびに月を満ちさせ、照らされる向きを回す
    private *cycle() {
        const light = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let k = 0; k < RINGS; k++) {
            const lit = Math.sin((Math.PI * (k + 1)) / (RINGS + 1))

            yield* Phase.ring(this, RING, light + (turn * k * T) / 12, lit).fire(this.game.bullets)
            yield* Array(RING_INTERVAL)
        }

        yield* Array(CYCLE_FRAMES - RINGS * RING_INTERVAL)
    }
}

class EnemyStar extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, STAR_LIFE, Size.S)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.05 * Math.sin(this.frame / 110)))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 90 + (side > 0 ? 55 : 0), loop: Infinity })
    }

    private *cycle() {
        yield* remodel(this)
            .format("big-ball")
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(13, T / 20)
            .g((me) => Behavior.accel(me, 60, 3))
            .fire(this.game.bullets)

        yield* Array(60)
    }
}
