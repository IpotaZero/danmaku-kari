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
import { Wind } from "./Wind"
import { Sickle } from "./Sickle"
import { Tornado } from "./Tornado"

// ステージ「疾風」(疾風道場・道場主)
// 門下生・高弟・師範代の技を、道場主が一段ずつ強めて順に見せる。
// 一段目: 横風。雨の列が三度の突風で左右に流される。突風の合間にゆっくりした輪が混ざる。
// 二段目: 鎌。道場主が自機のまわりへ三本の鎌を続けて投げる。鎌は輪の向きを交互に変えて戻ってくる。
// 三段目: 竜巻。竜巻が画面を横切る間、道場主が二度、ゆっくりした矢を投げる。
// 最終段: 嵐。左右の端から同時に竜巻が立ち、画面の真ん中ですれ違う。二本とも抜けなければならない。

const ENTRANCE_FRAMES = 150

const RAIN: Wind.Rain = { gap: 64, frames: 300, interval: 5, speed: 4.5 }
const WIND: Wind.Shape = { angle: T / 9, rise: 20, hold: 40, fall: 20 }
const GUST_AT = [80, 200, 320]
// 一段目の1周期。雨が画面下へ抜けた後、3秒ほど休憩が入る
const CYCLE0_FRAMES = 720

// 二段目。鎌を投げる間隔と本数
const SICKLE_INTERVAL = 40
const SICKLE_COUNT = 3
const SICKLE_SPREAD = 90
const CYCLE1_FRAMES = SICKLE_INTERVAL * (SICKLE_COUNT - 1) + Sickle.TOTAL_FRAMES + 180

// 三段目・最終段。竜巻が抜けた後、2秒半ほど休憩が入る
const CYCLE2_FRAMES = Tornado.TOTAL_FRAMES + 150

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["すごい風。羽が持っていかれそう。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["おっそいなあ! 待ちくたびれて三回も昼寝しちゃったよ!"], { name: "ヤンマ" })
        yield* this.game.textBox.say(["あなたが疾風道場の長?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["そう、ボクがヤンマ! 風より速く飛ぶのが自慢さ!"], { name: "ヤンマ" })
        yield* this.game.textBox.say(["風に流されても、慌てず一緒に流れればいいんだよ。できるかな?"], { name: "ヤンマ" })
        this.hideFigure("hachinoko")

        const boss = new EnemyGale(this.game)
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
        yield* this.game.textBox.say(["うわー、目が回るー。"], { name: "ヤンマ" })
        yield* this.game.textBox.say(["速さだけなら負けてたかも。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["へへ、でも流されなかったのはキミの勝ち。疾風道場の免状をあげる!"], { name: "ヤンマ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(
            ["次は霧隠道場か砂塵道場かな。どっちも見通しが悪いから、目を凝らしていきなよ!"],
            { name: "ヤンマ" },
        )
        this.hideFigure("hachinoko")
    }
}

class EnemyGale extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 横風。三度の突風の向きは周期ごとに決め直す
    private *cycle0() {
        const forecast = new Wind.Forecast(
            GUST_AT.map((start) => ({ start, direction: this.random() < 0.5 ? -1 : 1 })),
            WIND,
        )

        yield* GenUtils.all({
            rain: forecast
                .rain(remodel(this), this.game, RAIN, this.random() * RAIN.gap)
                .format("diamond")
                .color("#9dffc8")
                .fire(this.game.bullets),
            streaks: forecast.streaks(remodel(this), this.game, this.random).fire(this.game.bullets),
            ring: this.ring(150),
            wait: Array(CYCLE0_FRAMES),
        })
    }

    private *ring(wait: number) {
        yield* Array(wait)

        yield* remodel(this)
            .format("donut")
            .color("#b8ffd8")
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(20)
            .fire(this.game.bullets)
    }

    // 鎌を三本、輪の向きを交互に変えながら続けて投げる
    private *cycle1() {
        for (let k = 0; k < SICKLE_COUNT; k++) {
            const target = this.game.player.p.add(vec.arg(this.random() * T).scale(this.random() * SICKLE_SPREAD))

            yield* Sickle.cast(remodel(this), this.p.clone(), target, k % 2 === 0 ? 1 : -1, this.random() * T)
                .color("#b8ffd8")
                .fire(this.game.bullets)

            yield* Array(SICKLE_INTERVAL)
        }

        yield* Array(CYCLE1_FRAMES - SICKLE_INTERVAL * SICKLE_COUNT)
    }

    // 竜巻を左右交互に立て、横切っている間に二度矢を投げる
    private *cycle2() {
        for (const side of [-1, 1]) {
            yield* GenUtils.all({
                tornado: Tornado.spin(remodel(this), this.game, side, this.random() * T)
                    .color("#b8ffd8")
                    .fire(this.game.bullets),
                arrows: this.arrows(),
                wait: Array(CYCLE2_FRAMES),
            })
        }
    }

    private *arrows() {
        for (let k = 0; k < 2; k++) {
            yield* Array(Tornado.FORM_FRAMES + 60)

            yield* remodel(this)
                .format("arrow")
                .color("#ffe9a8")
                .p(this.p.clone())
                .speed(0.5)
                .aim(this.game.player.p)
                .nway(5, T / 24)
                .g((me) => Behavior.accel(me, 90, 3.5))
                .fire(this.game.bullets)
        }
    }

    // 左右から同時に竜巻を立てる。二本は画面の真ん中ですれ違う
    private *cycle3() {
        yield* GenUtils.all({
            left: Tornado.spin(remodel(this), this.game, -1, this.random() * T)
                .color("#b8ffd8")
                .fire(this.game.bullets),
            right: Tornado.spin(remodel(this), this.game, 1, this.random() * T)
                .color("#d8e8ff")
                .fire(this.game.bullets),
            wait: Array(CYCLE2_FRAMES),
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
