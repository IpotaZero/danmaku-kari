import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Sand } from "./Sand"

// ステージ「砂塵」(砂塵道場・道場主)
// 一段目: 砂嵐。段の多い砂の帯が降りてくる間に、道場主が二度砂をかける。
// 二段目: 蟻地獄。道場主が自機を吸い寄せながら砂をかける。道場主を囲む砂の輪が、だんだん速く底へ滑り落ちてくる。
// 三段目: 砂時計。道場主が画面の真ん中に降りて、砂時計をひっくり返す。
// 最終段: 砂塵。砂の帯が降りてくる間ずっと、自機は上へ吸い寄せられる。筋の切れ目へ走りながら、吸い込みにも逆らう。

const ENTRANCE_FRAMES = 150

const BAND0: Sand.Band = { rows: 9, rowGap: 40, speed: 1.7, spacing: 10, segment: [90, 170], gap: [70, 110], flow: [1.2, 3] }
const BAND3: Sand.Band = { rows: 7, rowGap: 44, speed: 1.4, spacing: 10, segment: [80, 150], gap: [80, 120], flow: [1, 2.4] }

// 二段目。吸い込みの提示と、吸い込みの長さ
const SWIRL_FRAMES = 70
const SUCTION_FRAMES = 320
const CYCLE1_FRAMES = 620
// 道場主を囲む砂の輪の半径と弾の数
const PIT_RADIUS = 300
const PIT_GRAINS = 40

// 最終段の吸い込みは弱い
const SUCTION3 = 0.6

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["のどがからから……。砂ばっかりだ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ようこそ、砂塵道場へ。私はウスバ。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["あれ? さっきの高弟さんに似てる。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(
            ["あの子はまだ幼虫なの。私も昔は、巣の底でじっと待っていたものよ。"],
            { name: "ウスバ" },
        )
        yield* this.game.textBox.say(["でも今は飛べる。さあ、砂に足を取られないでね。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")

        const boss = new EnemySand(this.game)
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
        yield* this.game.textBox.say(["ふふ、砂を払うのが上手ね。"], { name: "ウスバ" })
        yield* this.game.textBox.say(["もう口の中までじゃりじゃりだよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["砂塵道場の免状よ。持っていって。"], { name: "ウスバ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(
            ["流星道場は夜にならないと始まらないわ。月影道場なら、昼でも薄暗いけれど。"],
            { name: "ウスバ" },
        )
        this.hideFigure("hachinoko")
    }
}

class EnemySand extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle" })
        yield

        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        // 砂時計の間は、くびれ(画面の真ん中)に留まる
        this.removeScript("move")
        this.addScript(() => this.moveTo(this.center(), 120), { id: "move" })
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.addScript(() => this.returnHome(), { id: "move" })
        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 150 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity, id: "move" })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *returnHome() {
        yield* this.moveTo(this.home(), 120)
        this.addScript(() => this.move(), { loop: Infinity, id: "move" })
    }

    // 砂嵐の帯が降りてくる間に、二度砂をかける
    private *cycle0() {
        const travel = Sand.travelFrames(this, BAND0)

        yield* GenUtils.all({
            storm: Sand.storm(this, BAND0),
            sand: (function* (me: EnemySand) {
                for (let k = 0; k < 2; k++) {
                    yield* Array(Math.floor(travel * 0.2))
                    yield* Sand.throwSand(me, 14).fire(me.game.bullets)
                }
            })(this),
            wait: Array(travel + 150),
        })
    }

    private *cycle1() {
        yield* GenUtils.all({
            swirl: Sand.swirl(this, SWIRL_FRAMES + SUCTION_FRAMES).fire(this.game.bullets),
            suction: (function* (me: EnemySand) {
                yield* Array(SWIRL_FRAMES)
                yield* Sand.suction(me, 1.1, SUCTION_FRAMES)
            })(this),
            sand: (function* (me: EnemySand) {
                yield* Array(SWIRL_FRAMES + 30)

                for (let k = 0; k < 5; k++) {
                    yield* Sand.throwSand(me, 16).fire(me.game.bullets)
                    yield* Array(60)
                }
            })(this),
            pit: this.pit(),
            wait: Array(CYCLE1_FRAMES),
        })
    }

    // 道場主を囲む砂の輪。少し留まってから、だんだん速く道場主へ向かって滑り落ちる。
    // 自機は吸い込みで内側へ寄せられているので、輪を外へくぐり抜けるか、内側で輪が縮むのをかわす
    private *pit() {
        const center = this

        yield* remodel(this)
            .format("small-ball")
            .color(Sand.COLOR)
            .speed(0)
            .duplicate(PIT_GRAINS, (b, i) => {
                b.p = this.p.add(vec.arg((T * i) / PIT_GRAINS).scale(PIT_RADIUS))
                return b
            })
            .appear(SWIRL_FRAMES)
            .g(function* (me) {
                yield* Array(SWIRL_FRAMES + 60)

                for (let diff = center.p.sub(me.p); diff.magnitude() > 24; diff = center.p.sub(me.p)) {
                    me.radian = diff.radian()
                    me.speed = Math.min(me.speed + 0.03, 2.5)
                    yield
                }

                me.life = 0
            })
            .fire(this.game.bullets)
    }

    private *cycle2() {
        const hourglass = new Sand.Hourglass([0, 1].map(() => (this.random() < 0.5 ? -1 : 1)))

        yield* GenUtils.all({
            hourglass: hourglass.draw(this, this.center()).fire(this.game.bullets),
            pour: hourglass.pour(this),
            wait: Array(Sand.Hourglass.TOTAL_FRAMES + Sand.Hourglass.FADE_FRAMES + 180),
        })
    }

    // 砂の帯が降りてくる間、ずっと自機を吸い寄せる
    private *cycle3() {
        const travel = Sand.travelFrames(this, BAND3)

        yield* GenUtils.all({
            storm: Sand.storm(this, BAND3),
            swirl: Sand.swirl(this, travel).fire(this.game.bullets),
            suction: Sand.suction(this, SUCTION3, travel),
            wait: Array(travel + 150),
        })
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(150))
        this.isInvincible = true
    }
}
