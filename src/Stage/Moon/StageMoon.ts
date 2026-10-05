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
import { Shadow } from "./Shadow"
import { Phase } from "./Phase"
import { Mochi } from "./Mochi"

// ステージ「月影」(月影道場・道場主)
// 一段目: 影踏み。自機の影が足跡を残してついてくる中へ、道場主がゆっくりした輪を放つ。
// 二段目: 満ち欠け。照らされた弧だけが実体の輪が、新月から満月へ満ちてまた欠ける。
// 三段目: 月の兎。道場主が餅を放り、餅は底で弾んで衝撃波を広げる。
// 最終段: 月影。影に追われながら、満ち欠けする輪をくぐる。立ち止まって輪の影の側を待つことはできない。

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#e0d8ff"

const SHADOW0: Shadow.Config = { delay: 45, stepInterval: 5, stepLife: 150, frames: 330, color: "#b8a8ff" }
const CYCLE0_FRAMES = SHADOW0.frames + SHADOW0.stepLife + 140

const RING: Phase.Ring = { count: 40, speed: 2, color: "#fff2c0" }
const RINGS = 9
const RING_INTERVAL = 28
const CYCLE1_FRAMES = RINGS * RING_INTERVAL + 200

const MOCHI: Mochi.Config = {
    gravity: 0.16,
    restitution: 0.82,
    bounces: 3,
    waveCount: 13,
    waveSpeed: 2.2,
    color: "#fff6e8",
}
const CYCLE2_FRAMES = 560

const SHADOW3: Shadow.Config = { delay: 50, stepInterval: 6, stepLife: 120, frames: 300, color: "#b8a8ff" }
const CYCLE3_FRAMES = SHADOW3.frames + SHADOW3.stepLife + 140

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["しんとしてる……。虫の声しか聞こえない。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["リーン……リーン……。今宵は良い月ですね。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["あなたが月影道場の長?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(
            ["ええ。月の光は影を生みます。影から逃れようとするほど、影はついてくるものですよ。"],
            { name: "スズムシ" },
        )
        this.hideFigure("hachinoko")

        const boss = new EnemyMoon(this.game)
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
        yield* this.game.textBox.say(["見事です。影を連れたまま、月まで届きましたね。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["もう足がくたくただよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["月影道場の免状を。よく休んでくださいね。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["すべての免状が揃ったなら、四天王があなたを待っています。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyMoon extends Enemy {
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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.18)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *rings(count: number, interval: number) {
        for (let k = 0; k < count; k++) {
            yield* remodel(this)
                .format("donut")
                .color(COLOR)
                .p(this.p.clone())
                .speed(1.4)
                .radian(this.random() * T)
                .ex(18)
                .g((me) => Behavior.appear(me, 20))
                .fire(this.game.bullets)

            yield* Array(interval)
        }
    }

    // 新月から満月へ満ちてまた欠ける輪を、照らされる向きを回しながら広げる
    private *phases(count: number, interval: number) {
        const light = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let k = 0; k < count; k++) {
            const lit = Math.sin((Math.PI * (k + 1)) / (count + 1))

            yield* Phase.ring(this, RING, light + (turn * k * T) / 12, lit).fire(this.game.bullets)
            yield* Array(interval)
        }
    }

    private *cycle0() {
        yield* GenUtils.all({
            shadow: Shadow.follow(this, SHADOW0),
            rings: (function* (me: EnemyMoon) {
                yield* Array(80)
                yield* me.rings(3, 90)
            })(this),
            wait: Array(CYCLE0_FRAMES),
        })
    }

    private *cycle1() {
        yield* this.phases(RINGS, RING_INTERVAL)
        yield* Array(CYCLE1_FRAMES - RINGS * RING_INTERVAL)
    }

    // 画面の左右へ交互に餅を放る
    private *cycle2() {
        for (let k = 0; k < 3; k++) {
            const side = k % 2 === 0 ? -1 : 1
            const x = this.game.WIDTH * (0.5 + side * (0.1 + 0.3 * this.random()))
            const landing = vec(x, this.game.HEIGHT - 22)
            const peak = this.game.HEIGHT * (0.05 + 0.08 * this.random())

            yield* Mochi.toss(this, landing, peak, MOCHI).fire(this.game.bullets)
            yield* Array(100)
        }

        yield* Array(CYCLE2_FRAMES - 300)
    }

    private *cycle3() {
        yield* GenUtils.all({
            shadow: Shadow.follow(this, SHADOW3),
            phases: (function* (me: EnemyMoon) {
                yield* Array(60)
                yield* me.phases(7, 36)
            })(this),
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
