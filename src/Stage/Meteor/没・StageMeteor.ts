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
import { Asteroid } from "./Asteroid"

// ステージ「迎撃」(流星道場・道場主)
// 空から隕石が降ってくる。隕石は撃ち砕ける。大きな隕石は砕けると小さな隕石に割れ、一番小さな隕石は砕けると消える。
// 撃ち漏らして地面に落ちた隕石は、上へ向かって破片を扇形に撒き散らす。どれを撃ち、どれを見逃すかを選びながら戦う。
// 一段目: 流星群。中くらいの隕石が次々に降る。
// 二段目: 隕石。大きな隕石がゆっくり降る。割るほど数は増えるが、小さくなる。
// 三段目: 蛍火。小さな隕石が速く降る中を、道場主の放つ蛍がふわふわと自機へ寄ってくる。蛍は撃っても消えない。
// 最終段: 天の岩。巨大な隕石がゆっくり降りてくる。地面に落ちれば大惨事。砕けば大きな隕石に割れ、さらに割れていく。

const ENTRANCE_FRAMES = 150
const FIREFLY: Color = "#d8ff90"

// 一段目
const SHOWER0_FRAMES = 420
const SHOWER0_INTERVAL = 46
// 二段目
const SHOWER1_FRAMES = 420
const SHOWER1_INTERVAL = 105
// 三段目
const SHOWER2_FRAMES = 360
const SHOWER2_INTERVAL = 18
// どの段も、降らせ終えてから休憩
const REST_FRAMES = 180

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["流れ星……じゃない、あれ、こっちに落ちてくる!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["流れ星はね、地面に落ちると隕石っていうの。"], { name: "ホタル" })
        yield* this.game.textBox.say(["落ちる前に撃ち落としてごらんなさい。全部は無理でも。"], { name: "ホタル" })
        this.hideFigure("hachinoko")

        const boss = new EnemyHotaru(this.game)
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
        yield* this.game.textBox.say(["空がきれいになったわね。"], { name: "ホタル" })
        yield* this.game.textBox.say(["撃っても撃っても割れて増えるんだもん。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふふ、それでも地面は守れたわ。流星道場の免状よ。"], { name: "ホタル" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyHotaru extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        yield

        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 90 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 画面の上の外の、自機の近くを避けすぎない程度にばらけた所から、大きさ size の隕石を一つ落とす
    private *meteor(size: Asteroid.Size, speed: number) {
        const w = this.game.WIDTH
        const x = w * (0.08 + 0.84 * this.random())
        // 画面の真ん中寄りへ向かうよう、少し斜めに落とす
        const radian = T / 4 + ((w / 2 - x) / w) * 0.5 + (this.random() - 0.5) * 0.2

        yield* Asteroid.drop(this, size, vec(x, -40), radian, speed).fire(this.game.bullets)
    }

    private *shower(size: Asteroid.Size, speed: number, frames: number, interval: number) {
        for (let f = 0; f < frames; f += interval) {
            yield* this.meteor(size, speed)
            yield* Array(interval)
        }
    }

    // ゆっくり広がる星屑の輪
    private *stardust(count: number) {
        yield* remodel(this)
            .format("small-ball")
            .color("#fff4c0")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.random() * T)
            .ex(count)
            .fire(this.game.bullets)
    }

    // 蛍。ふわふわと揺れながら、ゆっくり自機の方へ寄っていき、しばらくすると光を失って消える
    private *fireflies(count: number) {
        const player = this.game.player

        yield* remodel(this)
            .format("small-ball")
            .r(7)
            .color(FIREFLY)
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(count)
            .appear(20)
            .g(function* (me) {
                const phase = this.random() * T
                yield* Behavior.accel(me, 50, 0.6)

                for (let f = 0; f < 420; f++) {
                    // 自機の方へ少しずつ向きを変え、左右にふわふわ揺れる
                    const toward = player.p.sub(me.p).radian()
                    const diff = Math.atan2(Math.sin(toward - me.radian), Math.cos(toward - me.radian))
                    me.radian += Math.sign(diff) * Math.min(Math.abs(diff), 0.012) + 0.03 * Math.sin(phase + f / 14)
                    me.alpha = 0.85 + 0.15 * Math.sin(phase + f / 9)
                    yield
                }

                yield* Behavior.fadeout(me, 30)
            })
            .fire(this.game.bullets)
    }

    private *cycle0() {
        yield* GenUtils.all({
            shower: this.shower(1, 2.2, SHOWER0_FRAMES, SHOWER0_INTERVAL),
            stardust: (function* (me: EnemyHotaru) {
                for (let k = 0; k < 3; k++) {
                    yield* Array(120)
                    yield* me.stardust(20)
                }
            })(this),
        })

        yield* Array(REST_FRAMES)
    }

    private *cycle1() {
        yield* GenUtils.all({
            shower: this.shower(2, 1.6, SHOWER1_FRAMES, SHOWER1_INTERVAL),
            stardust: (function* (me: EnemyHotaru) {
                for (let k = 0; k < 2; k++) {
                    yield* Array(170)
                    yield* me.stardust(24)
                }
            })(this),
        })

        yield* Array(REST_FRAMES)
    }

    private *cycle2() {
        yield* GenUtils.all({
            shower: this.shower(0, 3.2, SHOWER2_FRAMES, SHOWER2_INTERVAL),
            fireflies: (function* (me: EnemyHotaru) {
                yield* me.fireflies(7)
                yield* Array(180)
                yield* me.fireflies(7)
            })(this),
        })

        yield* Array(REST_FRAMES)
    }

    // 巨大な隕石を画面の真ん中あたりへ落とし、そのまわりに蛍を放つ
    private *cycle3() {
        const w = this.game.WIDTH
        const x = w * (0.35 + 0.3 * this.random())

        yield* GenUtils.all({
            giant: Asteroid.drop(this, 3, vec(x, -80), T / 4, 1.0).fire(this.game.bullets),
            fireflies: (function* (me: EnemyHotaru) {
                for (let k = 0; k < 3; k++) {
                    yield* Array(200)
                    yield* me.fireflies(6)
                }
            })(this),
            wait: Array(900),
        })

        yield* Array(REST_FRAMES)
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(150))
        this.isInvincible = true
    }
}
