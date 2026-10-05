import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Shield } from "./Shield"

// ステージ「鉄壁」(鉄壁道場・道場主)
// 盾が道場主自身を守るので、ほかの道場と違って衛星はいない。道場主の体力が減るごとに段が進む。
// 一段目: 盾。道場主を回る盾の輪の窓から、弾の筋が灯台の光のように薙ぐ。
// 二段目: 城壁。窓の開いた城壁が次々に降りてくる。道場主は城壁越しに矢を射かける。
// 三段目: 亀甲。砕ける甲羅に穴を開けて撃ち込む。砕け残った甲羅は弾け飛ぶ。
// 最終段: 鉄壁。盾の輪と城壁が重なる。城壁の窓と盾の輪の窓がそろったときだけ、道場主に弾が届く。

const ENTRANCE_FRAMES = 150
const LIFE = 6400
// 体力がこの割合を下回るたびに、次の段へ進む
const THRESHOLDS = [0.75, 0.5, 0.25]
const COLOR: Color = "#9ab8ff"

const RING: Shield.RingConfig = { radius: 96, slots: 32, windowSlots: 4, spin: T / 600 }
const STREAM_FIRE = 90
const STREAM_REST = 120

const WALL: Shield.WallConfig = { spacing: 14, window: 64, build: 60, speed: 1.5 }
const WALL_INTERVAL = 170

const SHELL: Shield.ShellConfig = {
    spacing: 22,
    inner: 60,
    outer: 132,
    durability: 10,
    spin: T / 900,
    form: 40,
    hold: 440,
    warn: 50,
    shardSpeed: 2.6,
}

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["門も壁もかっちかち。どこから入るんだろう。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["正面からだ。鉄壁道場に裏口はない。"], { name: "カブト" })
        yield* this.game.textBox.say(["わっ、おっきい角!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["我が守りを崩せた者は数えるほどしかおらん。隙間を探せ。隙間は必ずある。"], {
            name: "カブト",
        })
        this.hideFigure("hachinoko")

        const boss = new EnemyIron(this.game)
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
        yield* this.game.textBox.say(["むう……。見事に隙間を突かれた。"], { name: "カブト" })
        yield* this.game.textBox.say(["小さいから、隙間を通るのは得意なんだ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["はっはっは! それも強さだ。鉄壁道場の免状を受け取れ。"], { name: "カブト" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["月影道場へ行くといい。あそこの守りは、また別の意味で固いぞ。"], {
            name: "カブト",
        })
        this.hideFigure("hachinoko")
    }
}

class EnemyIron extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)
    private readonly ring = new Shield.Ring(this, RING, this.random() * T)

    constructor(game: Game) {
        super(game, LIFE, 56, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.ring.build().fire(this.game.bullets), { id: "ring", margin: ENTRANCE_FRAMES })
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES + 60 })
        yield

        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 120 })
        yield

        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 120 })
        yield

        this.addScript(() => this.ring.build().fire(this.game.bullets), { id: "ring", margin: 60 })
        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 120 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)
        this.isInvincible = false

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    // 盾の輪の二つの窓から、外へ向けて弾を撃ち続ける
    private *stream() {
        for (let f = 0; f < STREAM_FIRE; f += 5) {
            const angle = this.ring.angle()

            yield* remodel(this)
                .format("diamond")
                .color(COLOR)
                .speed(3.5)
                .duplicate(2, (b, k) => {
                    b.p = this.ring.window(k)
                    b.radian = angle + (k * T) / 2
                    return b
                })
                .nway(3, T / 40)
                .fire(this.game.bullets)

            yield* Array(5)
        }
    }

    private *arrows(way: number) {
        yield* remodel(this)
            .format("arrow")
            .color("#ffe0a0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(way, T / 24)
            .g((me) => Behavior.accel(me, 50, 3.4))
            .fire(this.game.bullets)
    }

    // 窓を二つ開けた城壁を築いて降ろす。窓は画面の左右の半分に一つずつ開ける
    private *wall() {
        const width = this.game.WIDTH
        const windows = [0, 1].map((k) => (width * (k + 0.15 + 0.7 * this.random())) / 2)

        yield* Shield.wall(this, this.game.HEIGHT * 0.3, windows, WALL).fire(this.game.bullets)
    }

    private *cycle0() {
        yield* this.stream()

        yield* Array(30)
        yield* remodel(this)
            .format("small-ball")
            .color("#e0e8ff")
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(36)
            .g((me) => Behavior.appear(me, 20))
            .fire(this.game.bullets)

        yield* Array(STREAM_REST - 30)
    }

    private *cycle1() {
        yield* GenUtils.all({
            walls: (function* (me: EnemyIron) {
                for (let k = 0; k < 3; k++) {
                    yield* me.wall()
                    yield* Array(WALL_INTERVAL)
                }
            })(this),
            arrows: (function* (me: EnemyIron) {
                for (let k = 0; k < 4; k++) {
                    yield* Array(120)
                    yield* me.arrows(5)
                }
            })(this),
            wait: Array(900),
        })
    }

    private *cycle2() {
        yield* GenUtils.all({
            shell: Shield.shell(this, SHELL, this.random() * T).fire(this.game.bullets),
            arrows: (function* (me: EnemyIron) {
                for (let k = 0; k < 4; k++) {
                    yield* Array(110)
                    yield* me.arrows(3)
                }
            })(this),
            wait: Array(SHELL.form + SHELL.hold + SHELL.warn + 180),
        })
    }

    // 盾の輪が回り続ける中へ、城壁を降ろす
    private *cycle3() {
        yield* GenUtils.all({
            walls: (function* (me: EnemyIron) {
                for (let k = 0; k < 2; k++) {
                    yield* me.wall()
                    yield* Array(WALL_INTERVAL + 60)
                }
            })(this),
            stream: (function* (me: EnemyIron) {
                yield* Array(200)
                yield* me.stream()
            })(this),
            wait: Array(860),
        })
    }
}
