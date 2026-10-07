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
import { Water } from "./Water"

// ステージ「玄武」(四天王)
// 画面の下の方は水の中。玄武の弾は水に入ると速さが半分になり、真下寄りに折れ曲がる。水の中では弾が詰まって見える。
// 水の底に着いた弾は一度だけ跳ね返って上へ向かい、水面から出るときは速さが倍に戻って水面寄りに折れる。
// 水面すれすれに出ようとした弾は水面で跳ね返り、水の中に閉じ込められる。
// 水の上(弾はまばらで速い)と水の中(弾は密で遅い)、どちらで戦うかを選ぶ。
// 一段目: 水鏡。静かな水面へ扇形の弾が降り注ぐ。
// 二段目: 波。水面が波打ち、弾の折れ曲がり方が場所ごとに変わる。
// 三段目: 満ち潮。水面がゆっくり上がっては下がる。
// 最終段: 結氷。ときどき水が凍り、水の中の弾はその場で止まる。凍った水面に刺さった弾は、氷が解けると一斉に動き出す。

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#8ab8f0"
const RING_COLOR: Color = "#c8e0ff"
const CALM: Water.Waves = { height: 0, length: 1, period: 1 }

// 三段目。満ち引きの幅と周期
const TIDE = 0.2
const TIDE_PERIOD = 900
// 最終段。凍っていない時間と、凍っている時間
const LIQUID_FRAMES = 240
const FROZEN_FRAMES = 150

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["足もとが水びたし……つめたい。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が四、北の玄武。水の底より来る者。"], { name: "玄武" })
        yield* this.game.textBox.say(["水は形を変え、矢の向きをも変える。見誤るな。"], { name: "玄武" })
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
        yield* this.game.textBox.say(["水の中だと、弾がぎゅうぎゅうだったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["この先に、すべての道場の頂がいる。最後の試練だ。"], { name: "玄武" })
        this.hideFigure("hachinoko")
    }
}

class EnemyGenbu extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)
    private readonly surface = new Water.Surface(this.game.HEIGHT * 0.55, CALM)

    constructor(game: Game) {
        super(game, 2400, 60, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.surface.animate(this))
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        yield

        this.surface.waves = { height: 36, length: 240, period: 160 }
        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.surface.waves = { height: 14, length: 320, period: 220 }
        this.addScript(() => this.tide(), { id: "water" })
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.removeScript("water")
        this.surface.level = this.game.HEIGHT * 0.5
        this.surface.waves = CALM
        this.addScript(() => this.freezing(), { id: "water", margin: 90 })
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

    // 水面がゆっくり上がっては下がる
    private *tide() {
        const base = this.game.HEIGHT * 0.55

        for (let f = 0; ; f++) {
            this.surface.level = base - this.game.HEIGHT * TIDE * Math.sin((T * f) / TIDE_PERIOD)
            yield
        }
    }

    // 凍ったり解けたりをくり返す
    private *freezing() {
        while (true) {
            yield* Array(LIQUID_FRAMES)
            this.surface.frozen = true
            this.game.camera.shake(3, 10)
            yield* Array(FROZEN_FRAMES)
            this.surface.frozen = false
        }
    }

    // 水面で屈折する弾の下ごしらえ
    private shot() {
        const surface = this.surface

        return remodel(this)
            .p(this.p.clone())
            .g((me) => Water.swim(me, surface))
    }

    // 自機の方へ向けた扇
    private *fan(way: number, spread: number, speed: number) {
        yield* this.shot()
            .format("diamond")
            .color(COLOR)
            .speed(speed)
            .aim(this.game.player)
            .nway(way, spread)
            .fire(this.game.bullets)
    }

    private *ring(count: number, speed: number) {
        yield* this.shot()
            .format("small-ball")
            .r(6)
            .color(RING_COLOR)
            .speed(speed)
            .radian(this.random() * T)
            .ex(count)
            .fire(this.game.bullets)
    }

    private *cycle0() {
        for (let k = 0; k < 4; k++) {
            yield* this.fan(9, T / 40, 3)
            if (k === 1) yield* this.ring(20, 2.4)
            yield* Array(70)
        }

        yield* Array(150)
    }

    private *cycle1() {
        for (let k = 0; k < 5; k++) {
            yield* this.ring(24, 2.6)
            yield* Array(55)
        }

        yield* this.fan(7, T / 30, 3)
        yield* Array(160)
    }

    // 回る二本の腕。水の底で跳ね返った弾は、水面から上へ飛び出すか、水面で跳ね返って閉じ込められる
    private *cycle2() {
        const base = this.random() * T
        const turn = (this.random() < 0.5 ? -1 : 1) * (T / 400)

        for (let f = 0; f < 200; f += 6) {
            yield* this.shot()
                .format("diamond")
                .color(COLOR)
                .speed(3.2)
                .radian(base + turn * f)
                .ex(3)
                .fire(this.game.bullets)
            yield* Array(6)
        }

        yield* Array(160)
    }

    // 凍る前後に扇と輪を撃つ。凍った水面に刺さった弾は、氷が解けると一斉に動き出す
    private *cycle3() {
        yield* GenUtils.all({
            fans: (function* (me: EnemyGenbu) {
                for (let k = 0; k < 4; k++) {
                    yield* me.fan(9, T / 36, 3.2)
                    yield* Array(60)
                }
            })(this),
            rings: (function* (me: EnemyGenbu) {
                yield* Array(30)
                for (let k = 0; k < 3; k++) {
                    yield* me.ring(22, 2.2)
                    yield* Array(80)
                }
            })(this),
        })

        yield* Array(LIQUID_FRAMES + FROZEN_FRAMES - 270)
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(150))
        this.isInvincible = true
    }
}
