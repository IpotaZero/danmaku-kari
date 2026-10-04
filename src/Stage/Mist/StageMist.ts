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
import { Mist } from "./Mist"

// ステージ「霧隠」(霧隠道場・道場主)
// 一段目: 朧。道場主が桃色と青色の輪を交互に広げる。二色は時計に合わせて交互に霧になる。
// 二段目: 飛び石。市松模様の石が交互に霧になる中へ、道場主が苦無を投げる。
// 三段目: 霞隠れ。道場主が自機のまわりへ霧の手裏剣を次々に投げ、刺さった手裏剣が輪になって弾ける。
// 最終段: 五里霧中。石と輪が同じ時計で入れ替わる。今濃い色だけを見て、石の間を輪をくぐりながら飛び移る。

const ENTRANCE_FRAMES = 150
const COLORS: Color[] = ["#ffb0d0", "#a0c8ff"]

// 一段目。輪を広げ続ける時間と間隔
const CLOCK0 = new Mist.Clock(160, 36)
const RING_FRAMES = 240
const RING_INTERVAL = 18
const CYCLE0_FRAMES = 520

// 二段目
const CLOCK1 = new Mist.Clock(140, 30)
const FIELD1: Mist.Field = { spacing: 44, top: 0.34, intro: 70, active: CLOCK1.period * 3, fade: 30 }
const CYCLE1_FRAMES = FIELD1.intro + FIELD1.active + FIELD1.fade + 180

// 三段目。手裏剣を投げる間隔と本数
const SHURIKEN: Mist.Shuriken = { flight: 40, stuck: 45, burstCount: 16, burstSpeed: 1.8, color: "#e0e0ff" }
const SHURIKEN_INTERVAL = 18
const SHURIKEN_COUNT = 6
const CYCLE2_FRAMES = 2 * SHURIKEN_INTERVAL * SHURIKEN_COUNT + 60 + 300

// 最終段。石の間隔を広げ、輪はまばらにする
const CLOCK3 = new Mist.Clock(160, 36)
const FIELD3: Mist.Field = { spacing: 52, top: 0.4, intro: 70, active: CLOCK3.period * 3, fade: 30 }
const CYCLE3_FRAMES = FIELD3.intro + FIELD3.active + FIELD3.fade + 180

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["真っ白で何も見えない……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["見えないものを見ようとするから迷うのです。"], { name: "カゲロウ" })
        yield* this.game.textBox.say(["わっ、どこから!?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(
            ["私は霧隠道場の長、カゲロウ。濃いものだけを見なさい。薄いものは、ただの霧です。"],
            { name: "カゲロウ" },
        )
        this.hideFigure("hachinoko")

        const boss = new EnemyMist(this.game)
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
        yield* this.game.textBox.say(["霧が晴れてしまいましたね。"], { name: "カゲロウ" })
        yield* this.game.textBox.say(["濃いのと薄いの、だんだん見分けられるようになってきたよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["それが霧隠の極意です。免状をお持ちなさい。"], { name: "カゲロウ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["流星道場へお行きなさい。あそこは、よく晴れていますから。"], { name: "カゲロウ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyMist extends Enemy {
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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.17)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 二色の輪を交互に広げる。t は時計の時刻
    private *ring(phase: number, clock: Mist.Clock, t: number, count: number) {
        yield* remodel(this)
            .format("donut")
            .color(COLORS[phase])
            .p(this.p.clone())
            .speed(2.2)
            .radian(this.random() * T)
            .ex(count)
            .g((me) => clock.follow(me, phase, t))
            .fire(this.game.bullets)
    }

    private *cycle0() {
        for (let f = 0; f < RING_FRAMES; f += RING_INTERVAL) {
            yield* this.ring((f / RING_INTERVAL) % 2, CLOCK0, f, 28)
            yield* Array(RING_INTERVAL)
        }

        yield* Array(CYCLE0_FRAMES - RING_FRAMES)
    }

    private *cycle1() {
        yield* GenUtils.all({
            stones: Mist.stones(
                remodel(this),
                this.game,
                CLOCK1,
                FIELD1,
                vec(this.random(), this.random()).scale(FIELD1.spacing),
                COLORS,
            ).fire(this.game.bullets),
            kunai: this.kunai(),
            wait: Array(CYCLE1_FRAMES),
        })
    }

    private *kunai() {
        yield* Array(FIELD1.intro)

        for (let t = 0; t < FIELD1.active - 60; t += 60) {
            yield* remodel(this)
                .format("arrow")
                .r(16)
                .color("#ffe0a0")
                .p(this.p.clone())
                .speed(0.5)
                .aim(this.game.player.p)
                .nway(5, T / 28)
                .g((me) => Behavior.accel(me, 40, 3.2))
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }

    // 霧の手裏剣を、自機のまわりへ間を空けて投げる。2巡する
    private *cycle2() {
        for (let round = 0; round < 2; round++) {
            for (let k = 0; k < SHURIKEN_COUNT; k++) {
                const target = this.game.player.p.add(vec.arg(this.random() * T).scale(90 + this.random() * 80))

                yield* Mist.shuriken(remodel(this), this.game, this.p.clone(), target, SHURIKEN).fire(
                    this.game.bullets,
                )

                yield* Array(SHURIKEN_INTERVAL)
            }

            yield* Array(60)
        }

        yield* Array(CYCLE2_FRAMES - 2 * (SHURIKEN_INTERVAL * SHURIKEN_COUNT + 60))
    }

    // 石と輪が同じ時計で入れ替わる。輪は石の入れ替わりが始まってから、まばらに広げる
    private *cycle3() {
        yield* GenUtils.all({
            stones: Mist.stones(
                remodel(this),
                this.game,
                CLOCK3,
                FIELD3,
                vec(this.random(), this.random()).scale(FIELD3.spacing),
                COLORS,
            ).fire(this.game.bullets),
            rings: (function* (me: EnemyMist) {
                yield* Array(FIELD3.intro)

                for (let t = 0; t < FIELD3.active - 80; t += 40) {
                    yield* me.ring((t / 40) % 2, CLOCK3, t, 20)
                    yield* Array(40)
                }
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
