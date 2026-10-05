import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Sickle } from "./Sickle"

// ステージ「鎌鼬」(疾風道場・高弟)
// 左右の鼬(衛星)が、弾を弧に並べた鎌を投げる。鎌は回りながら自機のそばまで飛び、輪を描いて鼬の手元へ戻ってくる。
// 鎌の刃は弾が詰まっていて抜けられない。行きと帰りで違う側を通るので、一度かわしても帰りの鎌がもう一度来る。
// 鎌は鼬の手元で研がれて(大きさ0から育って)から飛ぶので、それが提示になる。
// 左右の鎌は少しずらして投げられ、自機のそばで交差する。そこへ高弟(ボス)がゆっくりした輪を重ねてくる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。鎌が戻りきった後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 460
// 右の鼬が投げるのを遅らせる
const THROW_LAG = 50
// 自機からどれだけずれた場所を狙うか
const AIM_SPREAD = 60

const WEASEL_LIFE = 900

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyWeasel(this.game, master, -1), new EnemyWeasel(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, WEASEL_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

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
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 鎌が自機のそばで交差するころに、ゆっくりした輪を2つ重ねる
    private *rings() {
        yield* Array(Sickle.SHARPEN_FRAMES + 50)

        for (let k = 0; k < 2; k++) {
            const count = 24

            yield* remodel(this)
                .format("donut")
                .color("#b8ffd8")
                .p(this.p.clone())
                .speed(2)
                .radian((T / count) * (k / 2) + this.random() * T)
                .ex(count)
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }
}

class EnemyWeasel extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, WEASEL_LIFE, 24)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.04 * Math.sin(this.frame / 150)))

        this.addScript(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            sickle: this.sickle(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 手元で鎌を研ぎ、自機のそばへ向けて投げる。鎌は輪を描いて投げた場所へ戻る。左右の鼬で鏡写しの輪を描く
    private *sickle(side: number) {
        if (side > 0) yield* Array(THROW_LAG)
        if (this.life <= 0) return

        const target = this.game.player.p.add(vec.arg(this.random() * T).scale(this.random() * AIM_SPREAD))

        yield* Sickle.cast(remodel(this), this.p.clone(), target, side, this.random() * T)
            .color("#b8ffd8")
            .fire(this.game.bullets)
    }
}
