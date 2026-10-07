import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Dune } from "./Dune"

// ステージ「砂丘」(砂塵道場・道場主)
// 空から注ぐ砂は画面の底に積もり、山になっていく。積もった砂は実体なので、砂山が育つほど動ける場所は下から狭まる。
// 砂の筋は抜けられないので、筋と筋の間、砂山と砂山の谷間に居場所を探す。
// 一段目: 砂山。三本の砂の筋が注ぎ、その下に砂山が育つ。注ぎ終わると砂山は沈んで消える。
// 二段目: 風紋。風が吹き、砂の筋は斜めに注ぐ。積もった砂山は風下へじわじわ流されていき、谷間も一緒に動く。
// 三段目: 逆さ砂。砂山が育ちきると震え出し、上へ向かって落ちていく。砂山は縦の柱になって昇るので、砂のなかった列に立つ。
// 最終段: 砂漠。道場主が左右に飛び回りながら砂を撒き、風が砂丘を流し、育った砂丘はやがて空へ落ちていく。
// どの段でも、道場主はときどき砂つぶて(ゆっくりした扇形の砂)を投げる。

const ENTRANCE_FRAMES = 150
const SAND_ALT: Color = "#ffe8b8"

// 砂の筋。砂粒を出す間隔と速さ。筋の中の砂粒の間隔(15px)は砂粒の大きさとほぼ同じなので、筋は抜けられない
const POUR_INTERVAL = 3
const POUR_SPEED = 5
// 砂山ができあがってから、沈む・昇るまで眺める時間
const HOLD_FRAMES = 60
// 休憩
const REST_FRAMES = 150

// 一段目
const POUR0_FRAMES = 300
// 二段目。風で筋が傾く角度と、砂丘が一列流れる間隔
const WIND_ANGLE = 0.12
const SHIFT_INTERVAL = 24
const POUR1_FRAMES = 340
// 三段目。砂山が震えている時間と、昇っていく速さ
const POUR2_FRAMES = 280
const TREMBLE_FRAMES = 50
const RISE_SPEED = 5
// 最終段
const POUR3_FRAMES = 360

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["足もとが、さらさら鳴ってる。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["砂はね、積もるのよ。どこまでも。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["埋もれてしまう前に、私を落としてごらんなさい。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")

        const boss = new EnemyUsuba(this.game)
        const cores = [0, 1, 2].map((i) => new EnemyCore(this.game, boss, i))

        this.game.enemies.push(boss, ...cores)
        cores[0].isInvincible = false

        const phase = boss.start()
        phase.next()

        for (let i = 0; i < cores.length; i++) {
            yield* this.waitDead([cores[i]])

            if (i + 1 < cores.length) {
                cores[i + 1].isInvincible = false
            } else {
                boss.isInvincible = false
            }

            phase.next()
            this.scorenizeAllBullets()
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ふふ、埋もれなかったわね。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["靴の中まで砂だらけだよ……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["砂塵道場の免状よ。払ってからお行きなさい。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyUsuba extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)
    // 最終段で飛び回る道筋
    private readonly sweep = Curves.lissajous(this.game.WIDTH * 0.75, this.game.HEIGHT * 0.06, 1, 2)
    // いま積もっている砂丘。段が変わると作り直す
    private dune = new Dune.Field(this.game)

    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        yield

        this.dune = new Dune.Field(this.game)
        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 120 })
        yield

        this.dune = new Dune.Field(this.game)
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 120 })
        yield

        this.dune = new Dune.Field(this.game)
        this.addScript(() => this.sweeping(), { loop: Infinity, id: "move" })
        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 120 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity, id: "move" })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 最終段。画面の端から端へ、ゆっくり大きく飛び回る
    private *sweeping() {
        const start = this.frame
        const from = this.p.clone()

        for (let f = 1; f <= 90; f++) {
            this.p = from.add(
                this.sweep(0)
                    .add(this.home())
                    .sub(from)
                    .scale(f / 90),
            )
            yield
        }

        while (true) {
            this.p = this.sweep((this.frame - start - 90) / 700).add(this.home())
            yield
        }
    }

    // 注ぎ終えた砂が、すべて底に着くまでのフレーム数
    private fallFrames() {
        return Math.ceil(this.game.HEIGHT / POUR_SPEED) + 20
    }

    // 空の xs の位置から、frames の間砂を注ぐ。radian は砂の落ちる向き
    private *pour(xs: readonly number[], frames: number, radian: number) {
        for (let f = 0; f < frames; f += POUR_INTERVAL) {
            for (const x of xs) {
                yield* this.dune.grain(this, x + (this.random() - 0.5) * 4, radian, POUR_SPEED).fire(this.game.bullets)
            }

            yield* Array(POUR_INTERVAL)
        }
    }

    // 砂つぶて。ゆっくりした扇形の砂を自機の方へ投げる
    private *pebbles() {
        const aim = this.game.player.p.sub(this.p).radian()

        yield* remodel(this)
            .format("diamond")
            .color(SAND_ALT)
            .p(this.p.clone())
            .speed(0.5)
            .radian(aim)
            .nway(7, T / 28)
            .g((me) => Behavior.accel(me, 60, 2.6))
            .fire(this.game.bullets)
    }

    private *pebblesEvery(interval: number, count: number) {
        for (let k = 0; k < count; k++) {
            yield* Array(interval)
            yield* this.pebbles()
        }
    }

    // 三本の筋の位置。周期ごとに少しずらす
    private streams(count: number) {
        const w = this.game.WIDTH
        return Array.from({ length: count }, (_, k) => (w * (k + 0.5)) / count + (this.random() - 0.5) * 50)
    }

    private *cycle0() {
        yield* GenUtils.all({
            pour: this.pour(this.streams(3), POUR0_FRAMES, T / 4),
            pebbles: this.pebblesEvery(90, 4),
            wait: Array(POUR0_FRAMES + this.fallFrames() + HOLD_FRAMES),
        })

        this.dune.clear()
        yield* Array(REST_FRAMES)
    }

    // 風の吹く向きを決め、斜めに砂を注ぎながら、砂丘を風下へ流していく
    private *cycle1() {
        const wind = this.random() < 0.5 ? -1 : 1
        const dune = this.dune

        yield* GenUtils.all({
            pour: this.pour(this.streams(4), POUR1_FRAMES, T / 4 - wind * WIND_ANGLE),
            drift: (function* (frames: number) {
                for (let f = 0; f < frames; f += SHIFT_INTERVAL) {
                    yield* Array(SHIFT_INTERVAL)
                    dune.shift(wind)
                }
            })(POUR1_FRAMES + this.fallFrames() + HOLD_FRAMES),
            pebbles: this.pebblesEvery(110, 4),
        })

        this.dune.clear()
        yield* Array(REST_FRAMES)
    }

    // 砂山を育て、震わせてから空へ落とす
    private *cycle2() {
        yield* GenUtils.all({
            pour: this.pour(this.streams(3), POUR2_FRAMES, T / 4),
            pebbles: this.pebblesEvery(90, 3),
            wait: Array(POUR2_FRAMES + this.fallFrames() + HOLD_FRAMES),
        })

        this.dune.rise(TREMBLE_FRAMES, RISE_SPEED)
        yield* Array(TREMBLE_FRAMES + this.fallFrames() + REST_FRAMES)
    }

    // 飛び回る道場主の真下へ砂を撒く。風が砂丘を流し、撒き終わると砂丘は空へ落ちていく
    private *cycle3() {
        const wind = this.random() < 0.5 ? -1 : 1
        const dune = this.dune

        yield* GenUtils.all({
            pour: (function* (me: EnemyUsuba) {
                for (let f = 0; f < POUR3_FRAMES; f += 3) {
                    yield* dune.grain(me, me.p.x, T / 4, POUR_SPEED).fire(me.game.bullets)
                    yield* Array(3)
                }
            })(this),
            drift: (function* (frames: number) {
                for (let f = 0; f < frames; f += SHIFT_INTERVAL * 2) {
                    yield* Array(SHIFT_INTERVAL * 2)
                    dune.shift(wind)
                }
            })(POUR3_FRAMES + this.fallFrames()),
            pebbles: this.pebblesEvery(120, 4),
        })

        yield* Array(HOLD_FRAMES)
        this.dune.rise(TREMBLE_FRAMES, RISE_SPEED)
        yield* Array(TREMBLE_FRAMES + this.fallFrames() + REST_FRAMES)
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(150))
        this.isInvincible = true
    }
}
