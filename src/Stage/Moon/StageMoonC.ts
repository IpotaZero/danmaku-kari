import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mochi } from "./Mochi"

// ステージ「月の兎」(三日前・月の草むら)
// 左右の兎(衛星)が、大きな餅を高く放り投げる。餅は放物線を描いて画面の底で弾み、弾むたびに底から半円の衝撃波が広がる。
// 餅は弾むたびに低くなっていく。放物線は読みやすいので、餅の下をくぐるか、弾む場所から離れて衝撃波をやり過ごす。
// 師範代(臼)は、ときどき杵でついたようにゆっくりした輪を放つ。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。最後の餅が消えた後、2秒ほど休憩が入る
const CYCLE_FRAMES = 620
// 兎が1周期に餅を放る回数と間隔
const TOSSES = 2
const TOSS_INTERVAL = 140
const MOCHI: Mochi.Config = {
    gravity: 0.16,
    restitution: 0.82,
    bounces: 3,
    waveCount: 11,
    waveSpeed: 2.2,
    color: "#fff6e8",
}

const RABBIT_LIFE = 700

export default class extends Stage {
    *G() {
        const mortar = new EnemyMortar(this.game)
        this.game.enemies.push(mortar, new EnemyRabbit(this.game, mortar, -1), new EnemyRabbit(this.game, mortar, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMortar extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, RABBIT_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity, margin: 100 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    // 杵でつくように、ゆっくりした輪を2つ続けて放つ
    private *cycle() {
        for (let k = 0; k < 2; k++) {
            yield* remodel(this)
                .format("donut")
                .color("#e0d8ff")
                .p(this.p.clone())
                .speed(1.5)
                .radian(this.random() * T + (k * T) / 40)
                .ex(31)
                .g((me) => Behavior.appear(me, 20))
                .fire(this.game.bullets)

            yield* Array(30)
        }

        yield* Array(CYCLE_FRAMES / 2 - 60)
    }
}

class EnemyRabbit extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, RABBIT_LIFE, 24)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.05 * Math.sin(this.frame / 80)))

        this.addScript(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            tosses: this.tosses(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 画面の反対側の方へ、餅を高く放る。左右の兎で放る時刻をずらす
    private *tosses(side: number) {
        yield* Array(side > 0 ? TOSS_INTERVAL / 2 : 0)

        for (let k = 0; k < TOSSES; k++) {
            if (this.life <= 0) return

            const x = this.game.WIDTH * (0.5 - side * (0.05 + 0.35 * this.random()))
            const landing = vec(x, this.game.HEIGHT - 22)
            const peak = this.game.HEIGHT * (0.05 + 0.1 * this.random())

            yield* Mochi.toss(this, landing, peak, MOCHI).fire(this.game.bullets)
            yield* Array(TOSS_INTERVAL)
        }
    }
}
