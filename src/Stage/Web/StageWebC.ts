import { Vec, vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { GenUtils } from "../../utils/Functions/GeneratorUtils"

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
// 巣の形。縦糸の本数と、横糸の輪の数・間隔
const SPOKES = 8
const RINGS = 4
const RING_GAP = 30
// 糸を構成する弾の間隔。自機の当たり判定の8倍より狭いので、糸は抜けづらい
const THREAD_SPACING = 14
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

// 巣の形。中心から見た弾の位置を返す。
// 縦糸は中心から放射状に、横糸は隣り合う縦糸どうしを直線で結ぶ(本物の蜘蛛の巣と同じく多角形になる)
function web(): Vec[] {
    const result: Vec[] = []
    const radius = RING_GAP * RINGS

    for (let k = 0; k < SPOKES; k++) {
        const spoke = vec.arg((T * k) / SPOKES)

        for (let d = THREAD_SPACING; d <= radius; d += THREAD_SPACING) {
            result.push(spoke.scale(d))
        }
    }

    for (let ring = 1; ring <= RINGS; ring++) {
        const r = RING_GAP * ring

        for (let k = 0; k < SPOKES; k++) {
            const from = vec.arg((T * k) / SPOKES).scale(r)
            const edge = vec
                .arg((T * (k + 1)) / SPOKES)
                .scale(r)
                .sub(from)
            const count = Math.max(1, Math.ceil(edge.magnitude() / THREAD_SPACING))

            // 縦糸の弾は横糸の輪とちょうど重なる位置にあるとは限らないので、角(縦糸との交点)にも弾を置く
            for (let j = 0; j < count; j++) {
                result.push(from.add(edge.scale(j / count)))
            }
        }
    }

    return result
}

class EnemyMother extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, SPIDER_LIFE * SPIDER_COUNT + DANGLER_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
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
                .aim(this.game.player.p)
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
        super(game, SPIDER_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 600 + (T * index) / SPIDER_COUNT).scale(160))

        this.addScript(() => this.cycle(index), { margin: ENTRANCE_FRAMES, loop: Infinity })
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

        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const radius = RING_GAP * RINGS
        const near = this.game.player.p.add(
            vec.arg(this.random() * T).scale(this.random() * AIM_SPREAD),
        )
        // 巣が画面の外にはみ出すと、その糸はBulletのboundaryで消えてしまうので、画面の内側に収める
        const target = vec(
            Math.min(Math.max(near.x, radius), width - radius),
            Math.min(Math.max(near.y, height * 0.35), height - radius),
        )
        const start = this.p.clone()
        const angle = this.random() * T
        const offsets = web().map((o) => o.rotate(angle))
        const folded = 0.2

        yield* remodel(this)
            .format("small-ball")
            .color("#f4f0ff")
            .type("neutral")
            .alpha(0.3)
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = start.add(offsets[i].scale(folded))
                return b
            })
            .g(function* (me, i) {
                for (let f = 1; f <= FLIGHT_FRAMES; f++) {
                    const t = Ease.Out(f / FLIGHT_FRAMES)
                    me.p = start.add(target.sub(start).scale(t)).add(offsets[i].scale(folded + (1 - folded) * t))
                    yield
                }

                yield* Array(LAND_FRAMES)

                // ここから当たり判定が生まれる。見た目もはっきりさせる
                me.type = "enemy"
                me.alpha = 1
                yield* Array(SOLID_FRAMES)

                yield* Behavior.fadeout(me, 20)
            })
            .fire(this.game.bullets)
    }
}

class EnemyDangler extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, side: number) {
        super(game, DANGLER_LIFE, 24)

        this.addScript(() => this.enter(side))
    }

    private home(side: number) {
        return vec(this.game.WIDTH * (0.5 + side * 0.25), this.game.HEIGHT * 0.08)
    }

    private *enter(side: number) {
        this.p = this.home(side).add(vec(0, -this.game.HEIGHT * 0.2))
        yield* this.moveTo(this.home(side), ENTRANCE_FRAMES)

        this.addScript(() => this.move(side), { loop: Infinity })
        // 左右で途切れ目の来るタイミングをずらす
        this.addScript(() => this.thread(), {
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
