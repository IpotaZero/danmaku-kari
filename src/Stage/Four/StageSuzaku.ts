import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Phoenix } from "./Phoenix"

// ステージ「朱雀」(四天王)
// 一段目: 羽ばたき。朱雀の左右に広がる炎の翼が羽ばたき、打ち下ろすたびに羽根が揺れながら舞い落ちる。
// 二段目: 不死鳥。火の玉の輪が広がって止まり、灰になる。灰はしばらくして燃え上がり、四方から自機へ向かってくる。
//   灰のうちは当たり判定がないので、燃え上がる前に灰の少ない方へ寄っておく。
// 三段目: 火の雨。空から火の粉が降り、あちこちで灰になる。灰は燃え上がって、ばらばらの向きへ飛び散る。
// 最終段: 鳳凰。翼が羽ばたく中で、不死鳥の輪が燃え上がる。

const ENTRANCE_FRAMES = 150

const WING: Phoenix.Wing = { feathers: 11, spacing: 19, amplitude: 0.5, period: 110 }
const REBIRTH: Phoenix.Rebirth = { ash: 60, speed: 2.6 }
const SCATTER: Phoenix.Rebirth = { ash: 50, speed: 2.2 }

const CYCLE0_FRAMES = WING.period * 4 + 160
const CYCLE1_FRAMES = 560
const CYCLE2_FRAMES = 620
const CYCLE3_FRAMES = WING.period * 5 + 160

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["あったかい……というか、熱い!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が二、南の朱雀。炎は尽きても、灰から蘇る。"], { name: "朱雀" })
        yield* this.game.textBox.say(["灰になったものに油断するでないぞ。"], { name: "朱雀" })
        this.hideFigure("hachinoko")

        const boss = new EnemySuzaku(this.game)
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
        yield* this.game.textBox.say(["我が炎を鎮めるとは。だが、また蘇るまでのこと。"], { name: "朱雀" })
        yield* this.game.textBox.say(["次に会うときも、負けないよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["よかろう。西へ行け。白虎の爪は鋭いぞ。"], { name: "朱雀" })
        this.hideFigure("hachinoko")
    }
}

class EnemySuzaku extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.12, this.game.HEIGHT * 0.03, 1, 2)

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

    private *cycle0() {
        yield* GenUtils.all({
            wings: Phoenix.flap(this, WING, WING.period * 4),
            wait: Array(CYCLE0_FRAMES),
        })
    }

    // 不死鳥の輪を3つ、少しずつずらして広げる
    private *cycle1() {
        for (let k = 0; k < 3; k++) {
            yield* Phoenix.ring(this, 20, REBIRTH).fire(this.game.bullets)
            yield* Array(60)
        }

        yield* Array(CYCLE1_FRAMES - 180)
    }

    private *cycle2() {
        yield* GenUtils.all({
            embers: Phoenix.embers(this, 60, 240, SCATTER).fire(this.game.bullets),
            wait: Array(CYCLE2_FRAMES),
        })
    }

    private *cycle3() {
        yield* GenUtils.all({
            wings: Phoenix.flap(this, WING, WING.period * 5),
            rings: (function* (me: EnemySuzaku) {
                for (let k = 0; k < 2; k++) {
                    yield* Array(WING.period * 2)
                    yield* Phoenix.ring(me, 16, REBIRTH).fire(me.game.bullets)
                }
            })(this),
            wait: Array(CYCLE3_FRAMES),
        })
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(110))
        this.isInvincible = true
    }
}
