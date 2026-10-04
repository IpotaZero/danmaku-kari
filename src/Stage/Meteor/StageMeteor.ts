import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Meteor } from "./Meteor"
import { Comet } from "./Comet"
import { Gravity } from "./Gravity"

// ステージ「流星」(流星道場・道場主)
// 一段目: 流星群。予告線に沿って流れ星が駆け抜け、尾が斜めの縞になって残る。向きを変えて二度。
// 二段目: 彗星。道場主が太陽になり、尾を引く彗星を4つ回す。
// 三段目: 重力。道場主が暗い星になり、夜空の左右の端から流れてくる弾の筋を曲げて、自分の向こう側に集める。
// 最終段: 星降る夜。彗星が回る中へ、流星群が降る。

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#fff4b0"

const METEOR: Meteor.Config = { preview: 60, speed: 10, tailInterval: 2, tailLife: 50, color: COLOR }
const LANE_GAP = 70
const FALL_RATE = 0.6
const CYCLE0_FRAMES = 560

const COMET: Comet.Config = {
    period: 300,
    orbits: 1.4,
    perihelion: 50,
    tailInterval: 3,
    tailLife: 40,
    color: "#bfe8ff",
}
const CYCLE1_FRAMES = 620

const LENS: Gravity.Config = { gm: 330, horizon: 40 }
const STREAMS = 9
const STREAM_GAP = 40
const CYCLE2_FRAMES = 470

const CYCLE3_FRAMES = 680

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["わあ、星がいっぱい。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["いらっしゃい。流星道場へようこそ。"], { name: "ホタル" })
        yield* this.game.textBox.say(["あれ、あなたも光ってる!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふふ、星の真似事よ。今夜は流れ星がよく降るわ。願いごとは決めてきた?"], {
            name: "ホタル",
        })
        yield* this.game.textBox.say(["えーと……免状がほしい!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["じゃあ、全部かわしてみせて。"], { name: "ホタル" })
        this.hideFigure("hachinoko")

        const boss = new EnemyFirefly(this.game)
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
        yield* this.game.textBox.say(["本当に全部かわしちゃった。"], { name: "ホタル" })
        yield* this.game.textBox.say(["流れ星、三回お願いする暇もなかったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["願いは自分で叶えたのね。流星道場の免状よ。"], { name: "ホタル" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["免状が揃ったら、四天王に挑めるわ。夜明けの方角へ進みなさい。"], {
            name: "ホタル",
        })
        this.hideFigure("hachinoko")
    }
}

class EnemyFirefly extends Enemy {
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

        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 150 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.24)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 斜めの向きを決め、平行な線の一部に予告線を引いて流れ星を流す
    private *shower(wait: number) {
        yield* Array(wait)

        const angle = T / 4 + (this.random() < 0.5 ? -1 : 1) * (T / 14 + (this.random() * T) / 14)
        const center = vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
        const normal = vec.arg(angle + T / 4)
        const reach = (this.game.WIDTH + this.game.HEIGHT) / 2
        const offset = this.random() * LANE_GAP

        const lanes = Array.from({ length: Math.ceil((reach * 2) / LANE_GAP) }, (_, k) =>
            center.add(normal.scale(-reach + offset + k * LANE_GAP)),
        ).filter(() => this.random() < FALL_RATE)

        yield* GenUtils.all(
            Object.fromEntries(
                lanes.map((through, k) => [
                    `lane${k}`,
                    (function* (me: EnemyFirefly) {
                        yield* Array(Math.floor(me.random() * lanes.length) * 10)
                        yield* Meteor.fall(me, through, angle, METEOR)
                    })(this),
                ]),
            ),
        )
    }

    // 画面の下の方のあちこちに彗星を放つ。自機の真上には出さない
    private *comets(count: number) {
        for (let k = 0; k < count; k++) {
            const x = this.game.WIDTH * (0.1 + 0.8 * this.random())
            const y = this.game.HEIGHT * (0.7 + 0.2 * this.random())
            const aphelion =
                Math.abs(x - this.game.player.p.x) < 120
                    ? vec((x + this.game.WIDTH / 2) % this.game.WIDTH, y)
                    : vec(x, y)

            yield* Comet.launch(this, aphelion, k % 2 === 0 ? 1 : -1, COMET).fire(this.game.bullets)
            yield* Array(40)
        }
    }

    private *cycle0() {
        yield* GenUtils.all({
            first: this.shower(0),
            second: this.shower(150),
            wait: Array(CYCLE0_FRAMES),
        })
    }

    private *cycle1() {
        yield* GenUtils.all({
            comets: this.comets(4),
            wait: Array(CYCLE1_FRAMES),
        })
    }

    // 夜空の左右の端から交互に、道場主の方へ向けて平行な筋を流す。筋は道場主の引力で曲がる
    private *cycle2() {
        for (const side of [-1, 1]) {
            const source = vec(this.game.WIDTH * (0.5 + side * 0.45), this.game.HEIGHT * 0.04)
            yield* this.curtain(source)
            yield* Array(40)
        }

        yield* Array(CYCLE2_FRAMES - 2 * (120 + 40))
    }

    private *curtain(source: Vec) {
        const lens = this
        const radian = this.p.sub(source).radian()
        const across = vec.arg(radian + T / 4)

        for (let f = 0; f < 120; f += 5) {
            yield* remodel(this)
                .format("small-ball")
                .color("#c8d8ff")
                .radian(radian)
                .speed(4)
                .duplicate(STREAMS, (b, k) => {
                    b.p = source.add(across.scale((k - (STREAMS - 1) / 2) * STREAM_GAP))
                    return b
                })
                .g((me) => Gravity.pull(me, lens, LENS))
                .appear(8)
                .fire(this.game.bullets)

            yield* Array(5)
        }
    }

    private *cycle3() {
        yield* GenUtils.all({
            comets: this.comets(2),
            shower: this.shower(120),
            wait: Array(CYCLE3_FRAMES),
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
