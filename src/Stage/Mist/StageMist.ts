import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Lantern } from "./Lantern"

// ステージ「灯籠」(霧隠道場・道場主)
// 道場主の撃つ弾はすべて霧で、そのままでは当たらない。ところが灯籠の光の中を通ると、霧は照らされて実体の弾になる。
// 灯籠の向こう側には、照らされた弾が光の筋のように伸びていく。筋の中に入らないこと、それだけを考えればよい。
// 灯籠は撃てば消える。自分のいる側の灯籠を消せば、そちらの筋はなくなる。段が変わると灯籠は灯し直される。
// 道場主の体力が減るごとに段が進む。
// 一段目: 灯明。三つの灯籠が据えられ、道場主の霧の渦が通るたびに、灯籠の向こうへ光の筋が扇形に伸びる。
// 二段目: 回り灯籠。四つの灯籠が道場主のまわりを回る。霧の輪が灯籠を通るたびに筋が生まれ、筋の向きはゆっくり回っていく。
// 三段目: 灯籠流し。灯籠が画面の上から下へ流れていき、そこへ霧雨が降る。灯籠の真下に、照らされた雨の筋が垂れる。
// 最終段: 朧月。大きな月の光が画面の下の方をさまよい、霧の渦がそこを通ると照らされる。月は撃っても消えない。

const ENTRANCE_FRAMES = 150
const LIFE = 4800
// 体力がこの割合を下回るたびに、次の段へ進む
const THRESHOLDS = [0.75, 0.5, 0.25]

const LANTERN_LIFE = 260
const LANTERN_RADIUS = 64

// 一段目。霧の渦の腕の数・回る速さ、霧を撃ち続ける時間と休む時間
const SPIRAL_ARMS = 12
const SPIRAL_SPIN = T / 260
const SPIRAL_FRAMES = 240
const REST_FRAMES = 160

// 二段目。灯籠が道場主のまわりを回る半径と、一周にかかる時間
const ORBIT_RADIUS = 175
const ORBIT_PERIOD = 1100

// 三段目。灯籠が流れる速さと、新しい灯籠を流す間隔
const FLOAT_SPEED = 0.9
const FLOAT_INTERVAL = 170

// 最終段。月の光の半径
const MOON_RADIUS = 110

const ARROW_COLOR: Color = "#ffd8a0"

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["霧の中に、ぽつぽつ灯りが見える……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["霧は霧。触れても何も起こりません。"], { name: "カゲロウ" })
        yield* this.game.textBox.say(["けれど灯に照らされた霧は、形を得ます。光の先にだけは、お気をつけなさい。"], {
            name: "カゲロウ",
        })
        this.hideFigure("hachinoko")

        const boss = new EnemyKagerou(this.game)
        this.game.enemies.push(boss)

        const phase = boss.start()
        phase.next()

        for (const ratio of THRESHOLDS) {
            while (boss.life > LIFE * ratio) yield

            phase.next()
            this.scorenizeAllBullets()
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……灯が、すべて消えてしまいましたね。"], { name: "カゲロウ" })
        yield* this.game.textBox.say(["光の先さえ見ていれば、霧はこわくなかったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["それが霧隠の極意。免状をお持ちなさい。"], { name: "カゲロウ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

// 灯籠。撃てば消える。位置は place で決まり、毎フレーム動く。灯した道場主(owner)が倒れると一緒に消える
class EnemyLantern extends Enemy {
    constructor(game: Game, owner: Enemy, field: Lantern.Field, place: (frame: number) => Vec, radius: number) {
        super(game, LANTERN_LIFE, 18)

        const light: Lantern.Light = { p: () => this.p, radius: () => radius, alive: () => this.life > 0 }
        field.add(light)

        this.p = place(0)
        this.addScript(
            function* (me) {
                if (owner.life <= 0) me.life = 0
                me.p = place(me.frame)
                yield
            },
            { loop: Infinity },
        )
        this.addScript(() => Lantern.glow(this, light))
    }
}

class EnemyKagerou extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)
    private readonly field = new Lantern.Field()
    // 今灯っている灯籠。段が変わると消して灯し直す
    private lanterns: EnemyLantern[] = []

    constructor(game: Game) {
        super(game, LIFE, 56, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        this.addScript(
            function* (me) {
                me.light(me.fixedLanterns())
            },
            { margin: ENTRANCE_FRAMES - 60 },
        )
        yield

        this.light(this.orbitingLanterns(4))
        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.light([])
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 60 })
        yield

        const moon = new EnemyLantern(this.game, this, this.field, (f) => this.moon(f), MOON_RADIUS)
        moon.isInvincible = true
        this.light([moon, ...this.orbitingLanterns(2)])
        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 90 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)
        this.isInvincible = false

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    // 灯籠を灯し直す。今の灯籠は消える
    private light(lanterns: EnemyLantern[]) {
        this.lanterns.forEach((l) => {
            l.life = 0
        })
        this.field.forget()
        this.lanterns = lanterns
        this.game.enemies.push(...lanterns)
    }

    // 一段目の、据え置きの三つの灯籠
    private fixedLanterns() {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT

        return [vec(0.18 * w, 0.48 * h), vec(0.5 * w, 0.4 * h), vec(0.82 * w, 0.48 * h)].map(
            (p) => new EnemyLantern(this.game, this, this.field, () => p, LANTERN_RADIUS),
        )
    }

    // 道場主のまわりを回る count 個の灯籠
    private orbitingLanterns(count: number) {
        return Array.from(
            { length: count },
            (_, k) =>
                new EnemyLantern(
                    this.game,
                    this,
                    this.field,
                    (f) => this.p.add(vec.arg((T * f) / ORBIT_PERIOD + (T * k) / count).scale(ORBIT_RADIUS)),
                    LANTERN_RADIUS,
                ),
        )
    }

    // 最終段の月。画面の下の方をゆっくりさまよう
    private moon(f: number) {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        return vec(w * (0.5 + 0.32 * Math.sin(f / 260)), h * (0.62 + 0.14 * Math.sin(f / 170 + 1)))
    }

    // 霧の弾を撃つ下ごしらえ
    private mist() {
        const field = this.field

        return remodel(this)
            .format("small-ball")
            .r(5)
            .p(this.p.clone())
            .g((me) => Lantern.mist(me, field))
    }

    // 灯の色をした、照らされた矢。最初はゆっくり、だんだん速くなる
    private *arrows(way: number) {
        yield* remodel(this)
            .format("arrow")
            .color(ARROW_COLOR)
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(way, T / 20)
            .g((me) => Behavior.accel(me, 60, 3.2))
            .fire(this.game.bullets)
    }

    // 霧の渦を撃ち続ける
    private *spiral(frames: number, arms: number, spin: number) {
        const base = this.random() * T

        for (let f = 0; f < frames; f += 3) {
            yield* this.mist()
                .speed(2.2)
                .radian(base + spin * f)
                .ex(arms)
                .fire(this.game.bullets)
            yield* Array(3)
        }
    }

    private *cycle0() {
        yield* GenUtils.all({
            spiral: this.spiral(SPIRAL_FRAMES, SPIRAL_ARMS, SPIRAL_SPIN * (this.random() < 0.5 ? -1 : 1)),
            arrows: (function* (me: EnemyKagerou) {
                for (let k = 0; k < 3; k++) {
                    yield* Array(70)
                    yield* me.arrows(3)
                }
            })(this),
            wait: Array(SPIRAL_FRAMES + REST_FRAMES),
        })
    }

    // 霧の輪を間を空けて広げる。回る灯籠を通った所だけが照らされる
    private *cycle1() {
        for (let k = 0; k < 10; k++) {
            yield* this.mist()
                .speed(2)
                .radian(this.random() * T)
                .ex(48)
                .fire(this.game.bullets)
            yield* Array(24)
        }

        yield* Array(REST_FRAMES)
    }

    // 灯籠を流しながら、霧雨を降らせる
    private *cycle2() {
        yield* GenUtils.all({
            lanterns: (function* (me: EnemyKagerou) {
                yield* me.floatLantern()
                yield* Array(FLOAT_INTERVAL)
                yield* me.floatLantern()
            })(this),
            rain: (function* (me: EnemyKagerou) {
                yield* Array(60)

                for (let f = 0; f < 260; f += 2) {
                    yield* me
                        .mist()
                        .p(vec(me.game.WIDTH * me.random(), 1))
                        .radian(T / 4)
                        .speed(3)
                        .fire(me.game.bullets)
                    yield* Array(2)
                }
            })(this),
            wait: Array(60 + 260 + REST_FRAMES),
        })
    }

    // 画面の上の、今流れている灯籠から離れた所に灯籠を浮かべ、下へ流す。画面の下を抜けたら消える
    private *floatLantern() {
        const w = this.game.WIDTH
        const others = this.lanterns.filter((l) => l.life > 0).map((l) => l.p.x)
        // 候補のうち、ほかの灯籠から一番離れたもの
        const apart = (x: number) => Math.min(w, ...others.map((o) => Math.abs(o - x)))
        const x = Array.from({ length: 6 }, () => w * (0.12 + 0.76 * this.random())).reduce((best, c) =>
            apart(c) > apart(best) ? c : best,
        )
        const height = this.game.HEIGHT

        const lantern = new EnemyLantern(
            this.game,
            this,
            this.field,
            (f) => vec(x + 18 * Math.sin(f / 40), -20 + FLOAT_SPEED * f),
            LANTERN_RADIUS,
        )
        lantern.addScript(function* (me) {
            while (me.p.y < height + 40) yield
            me.life = 0
        })

        this.lanterns = [...this.lanterns.filter((l) => l.life > 0), lantern]
        this.game.enemies.push(lantern)
    }

    // 霧の渦と霧の輪を交互に。月と、道場主のまわりを回る灯籠が照らす
    private *cycle3() {
        yield* GenUtils.all({
            spiral: this.spiral(200, 8, SPIRAL_SPIN * 0.7 * (this.random() < 0.5 ? -1 : 1)),
            arrows: (function* (me: EnemyKagerou) {
                yield* Array(120)
                yield* me.arrows(5)
            })(this),
            wait: Array(200 + 40),
        })

        for (let k = 0; k < 4; k++) {
            yield* this.mist()
                .speed(1.8)
                .radian(this.random() * T)
                .ex(40)
                .fire(this.game.bullets)
            yield* Array(30)
        }

        yield* Array(REST_FRAMES)
    }
}
