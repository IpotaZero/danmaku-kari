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
import { Shield } from "../Iron/Shield"
import { Serpent } from "./Serpent"
import { Tide } from "./Tide"

// ステージ「玄武」(四天王)
// 一段目: 甲羅。玄武は撃つと砕ける甲羅をまとう。時間が来ると砕け残った甲羅が弾け飛ぶので、まわりの核を狙いつつ甲羅も削っておく。
// 二段目: 蛇。玄武の尾の蛇が、点線の通り道に沿って自機のまわりにとぐろを巻く。とぐろの中へ矢が飛んでくる。
// 三段目: 波。うねる波の線が次々に降りてくる。線の切れ目は上下に揺れるので、揺れに合わせてくぐる。
// 最終段: 北の守り。甲羅にこもったまま、波を降らせる。波をくぐりながら甲羅に穴を開ける。

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#8ab0d8"

const SHELL: Shield.ShellConfig = {
    spacing: 22,
    inner: 60,
    outer: 132,
    durability: 10,
    spin: T / 900,
    form: 40,
    hold: 440,
    warn: 50,
    shardSpeed: 2.4,
}
const SNAKE: Serpent.Config = {
    segments: 30,
    lag: 6,
    speed: 3.4,
    preview: 70,
    headR: 22,
    bodyR: 15,
    color: "#7ad8a8",
}
const TIDE: Tide.Config = {
    lines: 5,
    lineGap: 130,
    speed: 1.3,
    spacing: 14,
    gap: 70,
    height: 30,
    wavelength: 260,
    period: 110,
    color: COLOR,
}
const FINAL_TIDE: Tide.Config = { ...TIDE, lines: 4, lineGap: 160, gap: 80 }

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["さむい……。冬みたい。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が四、北の玄武。亀と蛇、二つで一つの守りである。"], { name: "玄武" })
        yield* this.game.textBox.say(["甲羅を割り、蛇をかわし、波を越えよ。さすれば道は開かれよう。"], { name: "玄武" })
        this.hideFigure("hachinoko")

        const boss = new EnemyGenbu(this.game)
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
        yield* this.game.textBox.say(["見事なり。四天王、すべて破れたか。"], { name: "玄武" })
        yield* this.game.textBox.say(["はあ、はあ……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["この先に、すべての道場の頂がいる。最後の試練だ。"], { name: "玄武" })
        this.hideFigure("hachinoko")
    }
}

class EnemyGenbu extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        super(game, 2400, 56, { renderer: new EnemyRendererBoss() })
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
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    private *arrows(way: number) {
        yield* remodel(this)
            .format("arrow")
            .color("#e0f0ff")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(way, T / 24)
            .g((me) => Behavior.accel(me, 50, 3.2))
            .fire(this.game.bullets)
    }

    private *cycle0() {
        yield* GenUtils.all({
            shell: Shield.shell(this, SHELL, this.random() * T).fire(this.game.bullets),
            arrows: (function* (me: EnemyGenbu) {
                for (let k = 0; k < 4; k++) {
                    yield* Array(110)
                    yield* me.arrows(3)
                }
            })(this),
            wait: Array(SHELL.form + SHELL.hold + SHELL.warn + 180),
        })
    }

    // 尾の蛇が自機のまわりにとぐろを巻く
    private *cycle1() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const target = this.game.player.p
        const center = vec(
            Math.min(Math.max(target.x, 170), width - 170),
            Math.min(Math.max(target.y, height * 0.5), height - 170),
        )
        const coil = Serpent.coil(this.p.clone(), center, 220, 115, 1.7, this.p.sub(center).radian())

        yield* GenUtils.all({
            snake: Serpent.swim(this, coil, SNAKE),
            arrows: (function* (me: EnemyGenbu) {
                yield* Array(SNAKE.preview + 160)

                for (let k = 0; k < 4; k++) {
                    yield* me.arrows(5)
                    yield* Array(50)
                }
            })(this),
            wait: Array(SNAKE.preview + Serpent.swimFrames(coil, SNAKE) + 120),
        })
    }

    private *cycle2() {
        yield* GenUtils.all({
            tide: Tide.surge(this, TIDE),
            wait: Array(Tide.travelFrames(this, TIDE) + 120),
        })
    }

    private *cycle3() {
        yield* GenUtils.all({
            shell: Shield.shell(this, SHELL, this.random() * T).fire(this.game.bullets),
            tide: (function* (me: EnemyGenbu) {
                yield* Array(60)
                yield* Tide.surge(me, FINAL_TIDE)
            })(this),
            wait: Array(Math.max(SHELL.form + SHELL.hold + SHELL.warn, Tide.travelFrames(this, FINAL_TIDE)) + 180),
        })
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(170))
        this.isInvincible = true
    }
}
