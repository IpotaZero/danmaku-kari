import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"

// ステージ「霜」
// 空から小さな雪(ball 4)が降り、画面のあちこちで止まって大きな雪玉(ball 24)に育つ。
// 雪玉が画面を埋め尽くしたところで、一斉に下へ落ち始める。
// 画面全体が上から押し寄せてくるので、「居場所」がどんどん削られていく。
// 雪玉がそろうまでの間に、霜の核(ボス)がつららを撃ち込んでくる。
//
// 高速移動で雪玉を抜けても、抜けた先もまた雪玉の中である。弾を消さない限り居場所は増えない。
// 障壁を張れば、落ちてくる雪玉が結界に触れたそばからスコアに変わっていく。
// 「どこに結界を張るか」を、雪が降っている間(提示)に決めるステージ。

const ENTRANCE_FRAMES = 150
// 雪玉がすべて画面下へ抜けた後、約3秒の休憩が入る長さ
const CYCLE_FRAMES = 900
// 雪が降り始めてから降り終わるまで
const SNOW_FRAMES = 150
// 止まった雪が雪玉に育つまで
const GROW_FRAMES = 30
// 周期の開始から雪玉が一斉に落ち始めるまで
const DROP_FRAMES = 420
// 雪(小)が降る速さと、雪玉(大)が落ちる速さ
const FALL_SPEED = 4
const DROP_SPEED = 12
// この面積(px²)につき雪を1つ降らせる。小さいほど多い
const AREA_PER_SNOW = 9000

export default class extends Stage {
    *G() {
        // 雪虫と向かい合う。言葉は交わさない
        this.showFigure(Figure.hachinoko)
        this.showFigure(Figure.yukimushi)
        yield* Array(150)
        this.hideAllFigures()
        yield* Array(30)

        const boss = new EnemyFrost(this.game)
        const core0 = new EnemyCore(this.game, boss, 0)
        const core1 = new EnemyCore(this.game, boss, 1)
        const core2 = new EnemyCore(this.game, boss, 2)

        this.game.enemies.push(boss, core0, core1, core2)
        core0.isInvincible = false

        const phase = boss.start()
        phase.next()

        yield* this.waitDead([core0])
        core1.isInvincible = false
        phase.next()
        this.scorenizeAllBullets()

        yield* this.waitDead([core1])
        core2.isInvincible = false
        phase.next()
        this.scorenizeAllBullets()

        yield* this.waitDead([core2])
        boss.isInvincible = false
        phase.next()
        this.scorenizeAllBullets()

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        // 熱にへばった雪虫
        this.showFigure(Figure.yukimushiDefeat)
        yield* Array(150)
        this.hideAllFigures()
        yield* Array(30)
    }
}

class EnemyFrost extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.1, 2, 3)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 600).add(this.home())
        yield
    }

    private *cycle0() {
        yield* remodel(this)
            .format("small-ball")
            .color("#dff6ff")
            .p(this.p.clone())
            .speed(FALL_SPEED)
            .duplicate(120)
            .scatter({ p: 0.5, radian: [0, -T / 2], speed: [FALL_SPEED * 0.8, FALL_SPEED * 1.2] })
            .delete(120)
            .fire(this.game.bullets)

        yield* Array(180)

        yield* GenUtils.all({
            snow: this.snowfall(),
            icicles: this.icicles(),
            ring: this.ring(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 画面上端から雪を降らせる。それぞれが画面のどこかで止まって雪玉に育ち、DROP_FRAMESで一斉に落ちる。
    // 雪は画面の面積に比例した数だけ降るので、画面サイズが変わっても埋まり具合は変わらない
    private *snowfall() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const count = Math.floor((width * height) / AREA_PER_SNOW)

        yield* remodel(this)
            .format("small-ball")
            .speed(FALL_SPEED)
            .color("#dff6ff")
            .duplicate(count, (b, i) => {
                b.p = vec(this.random() * width, -3)
                b.radian = T / 4 + (this.random() - 0.5) * 0.3
                b.delay = Math.floor((i * SNOW_FRAMES) / count)
                return b
            })
            .g(function* (me) {
                const fallFrames = Math.floor((this.random() * height * 0.95) / FALL_SPEED)
                const stopFrames = 10

                yield* Array(fallFrames)
                yield* Behavior.stop(me, stopFrames)

                me.color = "#8fd8ff"
                yield* Behavior.ease(me, "r", 24, GROW_FRAMES, Ease.Out)

                yield* Array(Math.max(0, DROP_FRAMES - me.delay - fallFrames - stopFrames - GROW_FRAMES))

                // 全員が同じフレームに落ち始めるので、雪玉の並びを保ったまま画面が押し下がってくる。
                // 画面下に抜けた雪玉はBulletのboundaryで消える
                me.radian = T / 4
                yield* Behavior.accel(me, 360, DROP_SPEED)
            })
            .fire(this.game.bullets)
    }

    // 氷がそろったところへ、つららを3回撃ち込む。氷の隙間を縫って避けるか、結界で受け止めるか
    private *icicles() {
        yield* Array(240)

        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .format("arrow")
                .p(this.p.clone())
                .speed(1.5)
                .color("#bfe9ff")
                .aim(this.game.player)
                .nway(7, T / 28)
                .g(function* (me) {
                    yield* Behavior.accel(me, 40, 5)
                })
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }

    // つららの合間に、ゆっくりした輪。自機狙いだけで終わらせないための混ぜもの
    private *ring() {
        yield* Array(270)

        const count = 120

        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .speed(1.4)
            .ex(count)
            .color("#bfe9ff")
            .fire(this.game.bullets)
    }

    private *cycle1() {
        yield* remodel(this)
            .color("#bfe9ff")
            .format("diamond")
            .p(this.p.clone())
            .duplicate(13)
            .scatter({ p: 240, radian: [0, T], speed: [3, 6] })
            .delayByIndex(2)
            .ex(13)
            .g((me) => Behavior.reaccel(me, 60, 60, 60, 4))
            .fire(this.game.bullets)

        yield* Array(120)

        yield* remodel(this)
            .color("#bfe9ff")
            .format("arrow")
            .p(this.p.clone())
            .sim(3, 4, 8)
            .delayByIndex(10)
            .ex(31)
            .fire(this.game.bullets)

        yield* Array(300)
    }

    private *cycle2() {
        yield* GenUtils.all({
            cycle0: this.cycle2_0(),
            cycle1: this.cycle2_1(),
        })
    }

    private *cycle2_0() {
        while (1) {
            yield* remodel(this)
                .color("#bfe9ff")
                .format("arrow")
                .p(this.p.clone())
                .ex(23)
                .delayByIndex()
                .ex(2)
                .g(function* (me, _, i, j) {
                    yield* Behavior.stop(me, 30)
                    yield* Array(60 - i)
                    yield* GenUtils.all({
                        accel: Behavior.accel(me, 60, 4),
                        rotate: Behavior.rotating(me, (T / 6400) * (2 * (j % 2) - 1)),
                    })
                })
                .fire(this.game.bullets)

            yield* Array(12)
        }
    }

    private *cycle2_1() {
        while (1) {
            yield* remodel(this)
                .color("#bfe9ff")
                .format("diamond")
                .p(this.p.clone())
                .g((me) => Behavior.appear(me, 15))
                .duplicate(63)
                .scatter({ p: 120 })
                .delayByIndex()
                .speed(8)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .aim(this.game.player)
                .fire(this.game.bullets)

            yield* Array(120)
        }
    }

    private *cycle3() {
        yield* GenUtils.all({
            icicles: this.cycle3_0(),
            snow: this.cycle3_1(),
        })
        yield
    }

    private *cycle3_0() {
        while (1) {
            yield* remodel(this)
                .color("#39baff")
                .format("diamond")
                .p(this.p.clone())
                .g((me) => Behavior.appear(me, 15))
                .duplicate(7, (me, i) => {
                    me.radian = T * (i / 7)
                    me.speed = 4 + 4 * (i / 7)
                    return me
                })
                .delayByIndex(3)
                .ex(31)
                .g(function* (me) {
                    yield* Behavior.reaccel(me, 30, 30, 60)
                })
                .fire(this.game.bullets)

            yield* Array(240)
        }
    }

    private *cycle3_1() {
        while (1) {
            yield* remodel(this)
                .speed(1)
                .color("#bfe9ff")
                .format("small-ball")
                .duplicate(23, (me) => {
                    me.p = vec(me.game.WIDTH * this.random(), 0)
                    return me
                })
                .scatter({ radian: [0, T / 2] })
                .g(function* (me) {
                    yield* Behavior.reaccel(me, 30, 30, 60, 4)
                })
                .fire(this.game.bullets)

            yield* Array(20)
        }
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () =>
            vec.arg(this.frame / 360 + (T / 3) * index).scale(200 + 50 * Math.sin(this.frame / 720)),
        )
        this.isInvincible = true
    }
}
