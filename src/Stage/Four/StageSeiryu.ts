import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Serpent } from "./Serpent"

// ステージ「青龍」(四天王)
// 大きな弾を数珠つなぎにした龍が、四天王のもとから泳ぎ出す。龍の胴は抜けられない。
// 龍が泳ぎ出す前には通り道に薄い点線が引かれるので、龍の胴に囲まれない場所を先に選ぶ。
// 一段目: 昇龍。一匹の龍が画面をうねりながら下へ抜けていく。
// 二段目: 双龍。左右対称にうねる二匹の龍が、画面の真ん中で何度も交差する。
// 三段目: 龍の巻。龍が自機のまわりにとぐろを巻く。とぐろの中で、四天王の矢をかわす。
// 最終段: 天翔ける龍。長い龍が画面じゅうを何度も行き来する間、四天王が輪を放つ。

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#7ac8ff"

const DRAGON: Serpent.Config = {
    segments: 26,
    lag: 6,
    speed: 3,
    preview: 70,
    headR: 24,
    bodyR: 16,
    color: COLOR,
}
const TWIN: Serpent.Config = { ...DRAGON, segments: 22 }
const COIL: Serpent.Config = { ...DRAGON, segments: 30, speed: 3.4 }
const LONG: Serpent.Config = { ...DRAGON, segments: 38, speed: 3.4 }

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ここが四天王の間……。空気がぴりぴりする。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["よくぞ全ての道場を巡った。我は四天王が一、東の青龍。"], { name: "青龍" })
        yield* this.game.textBox.say(["龍の通り道は空に描かれる。読めぬ者は呑まれるのみ。"], { name: "青龍" })
        this.hideFigure("hachinoko")

        const boss = new EnemySeiryu(this.game)
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
        yield* this.game.textBox.say(["見事。龍の道を読み切ったか。"], { name: "青龍" })
        yield* this.game.textBox.say(["点線のおかげだよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふ、それを読むのが難しいのだ。南へ進め。朱雀が待っている。"], { name: "青龍" })
        this.hideFigure("hachinoko")
    }
}

class EnemySeiryu extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 画面の中の、左右に振れながら下っていく点を count 個選ぶ。start は最初に振れる向き
    private zigzag(count: number, start: number): Vec[] {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT

        return Array.from({ length: count }, (_, k) => {
            const side = (k % 2 === 0 ? 1 : -1) * start
            return vec(
                width * (0.5 + side * (0.2 + 0.2 * this.random())),
                height * (0.3 + (0.6 * (k + 0.5 + (this.random() - 0.5) * 0.4)) / count),
            )
        })
    }

    private *ring(count: number) {
        yield* remodel(this)
            .format("donut")
            .color("#c8ecff")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.random() * T)
            .ex(count)
            .g((me) => Behavior.appear(me, 20))
            .fire(this.game.bullets)
    }

    private *arrows() {
        yield* remodel(this)
            .format("arrow")
            .color("#e8f6ff")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(3, T / 30)
            .g((me) => Behavior.accel(me, 50, 3.2))
            .fire(this.game.bullets)
    }

    // 一匹の龍が画面をうねりながら下へ抜けていく
    private *cycle0() {
        const start = this.random() < 0.5 ? -1 : 1
        const points = this.zigzag(3, start)
        const exit = vec(points[2].x, this.game.HEIGHT + 120)
        const course = Serpent.through(this.p.clone(), points, exit)

        yield* GenUtils.all({
            dragon: Serpent.swim(this, course, DRAGON),
            rings: (function* (me: EnemySeiryu) {
                yield* Array(DRAGON.preview + 120)
                yield* me.ring(20)
                yield* Array(100)
                yield* me.ring(20)
            })(this),
            wait: Array(DRAGON.preview + Serpent.swimFrames(course, DRAGON) + 120),
        })
    }

    // 左右対称にうねる二匹の龍
    private *cycle1() {
        const width = this.game.WIDTH
        const points = this.zigzag(4, 1)
        const mirrored = points.map((p) => vec(width - p.x, p.y))
        const exit = vec(width / 2, this.game.HEIGHT + 120)
        const left = Serpent.through(this.p.clone(), points, exit)
        const right = Serpent.through(this.p.clone(), mirrored, exit)

        yield* GenUtils.all({
            left: Serpent.swim(this, left, TWIN),
            right: Serpent.swim(this, right, { ...TWIN, color: "#7affd8" }),
            wait: Array(TWIN.preview + Serpent.swimFrames(left, TWIN) + 120),
        })
    }

    // 自機のまわりにとぐろを巻き、画面の外へ抜けていく。とぐろの中へ矢を射かける
    private *cycle2() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const target = this.game.player.p
        const center = vec(
            Math.min(Math.max(target.x, 170), width - 170),
            Math.min(Math.max(target.y, height * 0.5), height - 170),
        )
        const coil = Serpent.coil(this.p.clone(), center, 230, 120, 1.6, this.p.sub(center).radian())

        yield* GenUtils.all({
            dragon: Serpent.swim(this, coil, COIL),
            arrows: (function* (me: EnemySeiryu) {
                yield* Array(COIL.preview + 150)

                for (let k = 0; k < 5; k++) {
                    yield* me.arrows()
                    yield* Array(45)
                }
            })(this),
            wait: Array(COIL.preview + Serpent.swimFrames(coil, COIL) + 120),
        })
    }

    // 長い龍が画面じゅうを何度も行き来し、画面の外へ抜ける。その間に輪を放つ
    private *cycle3() {
        const start = this.random() < 0.5 ? -1 : 1
        const points = this.zigzag(6, start)
        const exit = vec(this.game.WIDTH * (0.5 - start * 0.8), this.game.HEIGHT * 0.9)
        const course = Serpent.through(this.p.clone(), points, exit)

        yield* GenUtils.all({
            dragon: Serpent.swim(this, course, LONG),
            rings: (function* (me: EnemySeiryu) {
                yield* Array(LONG.preview + 100)

                for (let k = 0; k < 4; k++) {
                    yield* me.ring(24)
                    yield* Array(110)
                }
            })(this),
            wait: Array(LONG.preview + Serpent.swimFrames(course, LONG) + 120),
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
