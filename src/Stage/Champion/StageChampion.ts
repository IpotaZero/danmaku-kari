import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Swarm } from "./Swarm"

// ステージ「チャンピオン」
// チャンピオンのスズメバチは、蜂の群れを放つ。蜂は群れで飛び、仲間と寄り集まり向きをそろえながら自機を追ってくる。
// 蜂は急には曲がれないので、大きく動いて振り切れば、行き過ぎてぐるりと回ってくる。群れが赤く明滅したら、突撃の合図。
// チャンピオンの体力が減るごとに段が進む。
// 一段目: 斥候。一つの群れが追ってくる。
// 二段目: 巣。画面の真ん中に蜂の巣(六角形の部屋)が並び、部屋から蜂が飛び出してくる。巣の壁も実体なので、巣を盾にしながら逃げる。
// 三段目: 女王の針。チャンピオンが、予告の線に沿って針の列を撃ち込む。針を避けた先に群れが待っている。
// 最終段: 総攻撃。画面の左右から二つの群れが攻め寄せ、針も飛んでくる。

const ENTRANCE_FRAMES = 150
const LIFE = 7200
// 体力がこの割合を下回るたびに、次の段へ進む
const THRESHOLDS = [0.75, 0.5, 0.25]
const COLOR: Color = "#ffe080"
const NEEDLE: Color = "#ffd040"
const HIVE: Color = "#e8b040"

const SCOUTS: Swarm.Config = {
    speed: 2.6,
    force: 0.07,
    view: 70,
    personal: 28,
    cohesion: 0.5,
    alignment: 0.7,
    separation: 1.5,
    chase: 0.6,
    life: 420,
}
const WORKERS: Swarm.Config = { ...SCOUTS, speed: 2.4, life: 360 }
const SOLDIERS: Swarm.Config = { ...SCOUTS, speed: 2.8, force: 0.08, life: 400 }

// 突撃の身構えと、突撃している時間
const DIVE_WARN = 45
const DIVE_FRAMES = 50
// 針の予告の線を引いてから撃つまで
const NEEDLE_PREVIEW = 40
// 巣の部屋の大きさと、壁の弾の間隔
const CELL_RADIUS = 30
const WALL_SPACING = 11

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ここが、てっぺん……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["よく来た、小さな蜂の子。わたしがチャンピオンのスズメバチだ。"], {
            name: "スズメバチ",
        })
        yield* this.game.textBox.say(["一匹でここまで来たのは見事。だが、群れの力を知っているか?"], {
            name: "スズメバチ",
        })
        this.hideFigure("hachinoko")

        const boss = new EnemyHornet(this.game)
        this.game.enemies.push(boss)

        const phase = boss.start()
        phase.next()

        for (const ratio of THRESHOLDS) {
            while (boss.life > LIFE * ratio) yield

            phase.next()
            this.scorenizeAllBullets()
            this.shake(6, 20)
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……見事。群れごと振り切られるとは。"], { name: "スズメバチ" })
        yield* this.game.textBox.say(["一匹でも、ちゃんと飛べるんだよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["それが強さだ。今日からお前がチャンピオンだよ。"], { name: "スズメバチ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyHornet extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)
    // いま飛んでいる群れ。段が変わると新しい群れにする
    private flock = new Swarm.Flock(this, SCOUTS)

    constructor(game: Game) {
        super(game, LIFE, 56, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.lead(new Swarm.Flock(this, SCOUTS), ENTRANCE_FRAMES)
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        yield

        this.lead(new Swarm.Flock(this, WORKERS), 0)
        this.addScript(() => this.cycle1(), { id: "cycle", margin: 60 })
        yield

        this.lead(new Swarm.Flock(this, SOLDIERS), 0)
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 60 })
        yield

        this.lead(new Swarm.Flock(this, SOLDIERS), 0)
        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 60 })
        yield
    }

    // 群れを率いる。前の群れはもう率いない
    private lead(flock: Swarm.Flock, margin: number) {
        this.flock = flock
        this.addScript(() => flock.fly(), { id: "flock", margin })
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)
        this.isInvincible = false

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *ring(count: number) {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color(COLOR)
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(count)
            .fire(this.game.bullets)
    }

    // 女王の針。自機のあたりへ予告の線を引き、少しして線に沿って針の列を撃ち込む
    private *needle() {
        const start = this.p.clone()
        const target = this.game.player.p.add(vec((this.random() - 0.5) * 60, 0))
        const radian = target.sub(start).radian()

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color(NEEDLE)
            .r(2)
            .speed(0)
            .p(start)
            .radian(radian)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .unbounded()
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0.25, 12)
                yield* Array(NEEDLE_PREVIEW - 12)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(this.game.bullets)

        yield* Array(NEEDLE_PREVIEW)
        if (this.life <= 0) return

        yield* remodel(this)
            .format("line")
            .color(NEEDLE)
            .p(start)
            .radian(radian)
            .speed(11)
            .duplicate(6, (b, i) => {
                b.delay = i * 3
                return b
            })
            .fire(this.game.bullets)
    }

    // 斥候。チャンピオンのまわりから群れを放ち、しばらくして突撃させる。合間に輪を混ぜる
    private *cycle0() {
        yield* GenUtils.all({
            release: this.flock.release(this.p, 16).fire(this.game.bullets),
            dive: (function* (me: EnemyHornet) {
                yield* Array(200)
                yield* me.flock.dive(DIVE_WARN, DIVE_FRAMES)
            })(this),
            rings: (function* (me: EnemyHornet) {
                yield* Array(100)
                yield* me.ring(20)
                yield* Array(200)
                yield* me.ring(20)
            })(this),
        })

        yield* Array(SCOUTS.life + 30 - 300 + 120)
    }

    // 巣の部屋の真ん中。画面の真ん中あたりに、二段に並べる
    private cells(): Vec[] {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        return [
            vec(0.17 * w, 0.42 * h),
            vec(0.5 * w, 0.42 * h),
            vec(0.83 * w, 0.42 * h),
            vec(0.33 * w, 0.56 * h),
            vec(0.67 * w, 0.56 * h),
        ]
    }

    // 巣を建てる。六角形の部屋の壁は実体で、段が終わるまで残る
    private *hive(centers: readonly Vec[]) {
        const corners = Array.from({ length: 6 }, (_, k) => vec.arg((T * k) / 6 + T / 12).scale(CELL_RADIUS))
        const per = Math.round(CELL_RADIUS / WALL_SPACING)
        const walls = centers.flatMap((c) =>
            corners.flatMap((a, k) => {
                const b = corners[(k + 1) % 6]
                return Array.from({ length: per }, (_, i) => c.add(a.add(b.sub(a).scale(i / per))))
            }),
        )

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color(HIVE)
            .speed(0)
            .duplicate(walls.length, (b, i) => {
                b.p = walls[i]
                return b
            })
            .appear(40)
            .fire(this.game.bullets)
    }

    // 巣。部屋を建て、ランダムな部屋から蜂を飛び出させる
    private *cycle1() {
        const cells = this.cells()
        yield* this.hive(cells)
        yield* Array(60)

        while (true) {
            for (let k = 0; k < 2; k++) {
                const cell = cells[Math.floor(this.random() * cells.length)]
                yield* this.flock.release(cell, 8).fire(this.game.bullets)
                yield* Array(40)
            }

            yield* Array(120)
            yield* this.flock.dive(DIVE_WARN, DIVE_FRAMES)
            yield* Array(WORKERS.life - 250)
        }
    }

    // 女王の針。群れを放ち、針を三本撃ち込み、突撃させる
    private *cycle2() {
        yield* this.flock.release(this.p, 12).fire(this.game.bullets)
        yield* Array(80)

        for (let k = 0; k < 3; k++) {
            yield* this.needle()
            yield* Array(30)
        }

        yield* this.flock.dive(DIVE_WARN, DIVE_FRAMES)
        yield* Array(SOLDIERS.life + 30 - 80 - 3 * (NEEDLE_PREVIEW + 30) - DIVE_WARN - DIVE_FRAMES + 100)
    }

    // 総攻撃。画面の左右から群れを放ち、針を撃ち込み、突撃させる
    private *cycle3() {
        const w = this.game.WIDTH
        const y = this.game.HEIGHT * 0.4

        yield* this.flock.release(vec(30, y), 10).fire(this.game.bullets)
        yield* this.flock.release(vec(w - 30, y), 10).fire(this.game.bullets)

        yield* GenUtils.all({
            needles: (function* (me: EnemyHornet) {
                for (let k = 0; k < 3; k++) {
                    yield* Array(50)
                    yield* me.needle()
                }
            })(this),
            dive: (function* (me: EnemyHornet) {
                yield* Array(180)
                yield* me.flock.dive(DIVE_WARN, DIVE_FRAMES)
            })(this),
        })

        yield* Array(SOLDIERS.life + 30 - 3 * (50 + NEEDLE_PREVIEW) + 80)
    }
}
