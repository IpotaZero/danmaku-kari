import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { SpiderWeb } from "./SpiderWeb"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Size } from "../Size"

// 試作「蜘蛛の巣」
// 親蜘蛛(ボス)の周りを回る3匹の子蜘蛛(衛星)が、順番に自機のそばへ巣を投げる。
// 投げられた巣は薄い影(当たり判定なし)として飛び、広がりながら着地する。レーザーの予告線と同じ扱い。
// 着地してしばらくすると巣は実体になり、糸の上は弾が詰まっていて抜けられない。
// 影のうちに巣の外へ逃げるか、網目の中に収まるかを決める。内側の網目ほど狭いので、収まるには精密さがいる。
// 巣が張られて動ける場所が狭まったところへ、親蜘蛛がゆっくりした輪を撃ち込んでくる。
// さらに画面の上から2匹のぶら下がり蜘蛛が絶えず糸を垂らしており、画面は左・中・右の三つの帯に仕切られている。
// 糸はときどき途切れるので、帯を移るには途切れ目が降りてくるのを待って抜けるしかない。
// 巣から逃げる先が帯の中に限られるので、「どの帯で巣をやり過ごすか」まで考えることになる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。最後の巣が消えた後、3秒ほど休憩が入る
const CYCLE_FRAMES = 400
// 子蜘蛛が巣を投げる間隔。子蜘蛛の番号順に投げる
const THROW_INTERVAL = 30
// 巣が飛んでいる時間と、着地してから実体になるまでの時間(この二つが巣の提示)
const FLIGHT_FRAMES = 60
const LAND_FRAMES = 40
// 巣が実体でいる時間
const SOLID_FRAMES = 150
// 巣の形。糸を構成する弾の間隔は自機の当たり判定の8倍より狭いので、糸は抜けづらい
const WEB: SpiderWeb.Config = {
    spokes: 8,
    rings: 4,
    ringGap: 30,
    spacing: 14,
    flightFrames: FLIGHT_FRAMES,
    landFrames: LAND_FRAMES,
    solidFrames: SOLID_FRAMES,
}
// 自機からどれだけずれた場所に巣を投げるか
const AIM_SPREAD = 80

const SPIDER_COUNT = 3
const SPIDER_LIFE = 600

// ぶら下がり蜘蛛が垂らす糸。THREAD_INTERVALフレームごとに1弾、THREAD_SPEEDで落とすので、弾の間隔は両者の積になる。
// 12pxは自機の当たり判定の8倍より狭いので、糸は途切れ目以外では抜けられない
const THREAD_INTERVAL = 3
const THREAD_SPEED = 4
// 糸を垂らし続ける時間と、途切れる時間。途切れ目の長さは THREAD_GAP_FRAMES × THREAD_SPEED px
const THREAD_FRAMES = 90
const THREAD_GAP_FRAMES = 30
const DANGLER_LIFE = 500

export default class extends Stage {
    *G() {
        const core = new EnemyMother(this.game)
        this.game.enemies.push(core)
        this.game.enemies.push(...Array.from({ length: SPIDER_COUNT }, (_, i) => new EnemySpider(this.game, core, i)))
        this.game.enemies.push(new EnemyDangler(this.game, -1), new EnemyDangler(this.game, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMother extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, SPIDER_LIFE * SPIDER_COUNT + DANGLER_LIFE * 2, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *rings() {
        yield* Array(FLIGHT_FRAMES + LAND_FRAMES + 20)

        for (let k = 0; k < 2; k++) {
            yield* remodel(this)
                .format("diamond")
                .p(this.p.clone())
                .duplicate(63)
                .scatter({ p: 120, hue: [0, 360] })
                .aim(this.game.player)
                .delayByIndex()
                .speed(12)
                .appear(30)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .fire(this.game.bullets)

            yield* Array(THROW_INTERVAL + 20)
        }
    }
}

class EnemySpider extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, SPIDER_LIFE, Size.S)

        this.setParent(parent, () => vec.arg(this.frame / 600 + (T * index) / SPIDER_COUNT).scale(160))

        this.scripts.add(() => this.cycle(index), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(index: number) {
        yield* GenUtils.all({
            web: this.throwWeb(index),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自分の番が来たら、自機のそばへ巣を投げる。巣は小さく畳まれた影として飛び、広がりながら着地して、少し後に実体になる
    private *throwWeb(index: number) {
        yield* Array(index * THROW_INTERVAL)
        if (this.life <= 0) return

        const near = this.game.player.p.add(vec.arg(this.random() * T).scale(this.random() * AIM_SPREAD))
        const target = SpiderWeb.landing(this.game, near, WEB)

        yield* SpiderWeb.cast(remodel(this), WEB, this.p.clone(), target, this.random() * T)
            .color("#f4f0ff")
            .fire(this.game.bullets)
    }
}

class EnemyDangler extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, side: number) {
        super(game, DANGLER_LIFE, Size.S)

        this.scripts.add(() => this.enter(side))
    }

    private home(side: number) {
        return vec(this.game.WIDTH * (0.5 + side * 0.25), this.game.HEIGHT * 0.08)
    }

    private *enter(side: number) {
        this.p = this.home(side).add(vec(0, -this.game.HEIGHT * 0.2))
        yield* this.moveTo(this.home(side), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(side), { loop: Infinity })
        // 左右で途切れ目の来るタイミングをずらす
        this.scripts.add(() => this.thread(), {
            loop: Infinity,
            margin: side > 0 ? (THREAD_FRAMES + THREAD_GAP_FRAMES) / 2 : 0,
        })
    }

    // 糸の帯の幅がゆっくり変わるよう、左右に揺れる。左右の蜘蛛は逆向きに揺れる
    private *move(side: number) {
        const t = (this.frame - ENTRANCE_FRAMES) / 300 + (side > 0 ? Math.PI : 0)
        this.p = this.home(side).add(vec(Math.sin(t) * this.game.WIDTH * 0.12, 0))
        yield
    }

    // 真下へ糸を垂らし続け、ときどき途切れさせる
    private *thread() {
        for (let i = 0; i < THREAD_FRAMES; i += THREAD_INTERVAL) {
            yield* remodel(this)
                .format("small-ball")
                .color("#f4f0ff")
                .p(this.p.clone())
                .radian(T / 4)
                .speed(THREAD_SPEED)
                .fire(this.game.bullets)

            yield* Array(THREAD_INTERVAL)
        }

        yield* Array(THREAD_GAP_FRAMES)
    }
}
