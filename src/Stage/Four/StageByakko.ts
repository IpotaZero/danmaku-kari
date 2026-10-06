import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Magnet } from "./Magnet"

// ステージ「白虎」(四天王)
// 白虎の弾は N(赤)か S(青)の磁気を帯びている。自機も磁気を帯びていて、自機のまわりの輪の色で分かる。
// 自機と同じ色の弾は自機のそばでそれていき、違う色の弾は自機の方へ曲がって寄ってくる。輪と同じ色は味方、違う色は敵。
// 自機の磁気はときどき入れ替わる(入れ替わる前に輪が明滅する)。入れ替わった瞬間、味方と敵が逆になる。
// 白虎の体力が減るごとに段が進む。
// 一段目: 双極。赤い輪と青い輪が交互に広がる。磁気の入れ替わりはゆっくり。
// 二段目: 反転。赤と青の渦が回る。磁気がひんぱんに入れ替わる。
// 三段目: 磁力線。白虎の下の両脇に N極と S極が現れ、N極から湧いた弾が磁力線に沿って弧を描き、S極へ吸い込まれる。極を結ぶ線はゆっくり傾く。
// 最終段: 白虎。磁力線と、赤と青の輪が重なる。

const ENTRANCE_FRAMES = 150
const LIFE = 5600
// 体力がこの割合を下回るたびに、次の段へ進む
const THRESHOLDS = [0.75, 0.5, 0.25]
const LINE_COLOR: Color = "#ffe6a0"

// 三段目・最終段の極。二つの極の真ん中の、白虎から見た位置と、真ん中から極までの距離。
// 極を結ぶ線は、POLE_PERIOD フレームの周期で ±POLE_SWAY だけ傾く
const POLE_CENTER = vec(0, 230)
const POLE_DISTANCE = 150
const POLE_PERIOD = 900
const POLE_SWAY = 0.5
// 磁力線の弾を出す間隔と、一度に出す本数・速さ
const LINE_INTERVAL = 12
const LINE_WAYS = 9
const LINE_SPEED = 2.6

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……なんだか体がぴりぴりする。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が三、西の白虎。我が毛並みは磁気を帯びる。"], { name: "白虎" })
        yield* this.game.textBox.say(["引かれるか、退けるか。己の色を見失うな。"], { name: "白虎" })
        this.hideFigure("hachinoko")

        const boss = new EnemyByakko(this.game)
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
        yield* this.game.textBox.say(["……己の色を最後まで見失わなかったか。"], { name: "白虎" })
        yield* this.game.textBox.say(["赤と青で、目がちかちかするよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふん。北の玄武は我らの中で最も堅い。覚悟して行け。"], { name: "白虎" })
        this.hideFigure("hachinoko")
    }
}

class EnemyByakko extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.04, 1, 2)
    private readonly magnet = new Magnet.Field()

    constructor(game: Game) {
        super(game, LIFE, 60, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.magnet.show(this))
    }

    *start() {
        this.addScript(() => this.flipping(360, 90), { id: "flip", margin: ENTRANCE_FRAMES })
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        yield

        this.addScript(() => this.flipping(220, 60), { id: "flip" })
        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.flipping(300, 70), { id: "flip" })
        this.addScript(() => this.cycle2(), { id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.flipping(200, 60), { id: "flip" })
        this.addScript(() => this.cycle3(), { id: "cycle", margin: 90 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)
        this.isInvincible = false

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // interval ごとに、warn フレーム予告してから自機の磁気を入れ替える
    private *flipping(interval: number, warn: number) {
        while (true) {
            yield* Array(interval - warn)
            yield* this.magnet.flip(warn)
        }
    }

    // 磁気 polarity の輪
    private *ring(polarity: number, count: number, speed: number) {
        const magnet = this.magnet

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .p(this.p.clone())
            .speed(speed)
            .radian(this.random() * T)
            .ex(count)
            .g((me) => magnet.drift(me, polarity))
            .fire(this.game.bullets)
    }

    // 赤と青の輪を交互に
    private *cycle0() {
        const first = this.random() < 0.5 ? 1 : -1

        for (let k = 0; k < 4; k++) {
            yield* this.ring(k % 2 === 0 ? first : -first, 24, 2.2)
            yield* Array(50)
        }

        yield* Array(140)
    }

    // 赤と青の腕が交互に並んだ渦
    private *cycle1() {
        const base = this.random() * T
        const turn = (this.random() < 0.5 ? -1 : 1) * (T / 300)
        const magnet = this.magnet

        for (let f = 0; f < 180; f += 5) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .p(this.p.clone())
                .speed(2.4)
                .radian(base + turn * f)
                .ex(6)
                .g((me, i) => magnet.drift(me, i % 2 === 0 ? 1 : -1))
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(120)
    }

    // 白虎の下の両脇の極。極を結ぶ線は、シーソーのようにゆっくり傾く
    private pole(sign: number, start: number) {
        return () => {
            const angle = POLE_SWAY * Math.sin((T * (this.frame - start)) / POLE_PERIOD)
            return this.p.add(POLE_CENTER).add(vec.arg(angle).scale(sign * POLE_DISTANCE))
        }
    }

    // N極から、磁力線に沿って進む弾を扇形に湧かせる。扇は S極と反対側(極を結ぶ線の下側)へ開く
    private *fieldLines(north: () => Vec, south: () => Vec, frames: number) {
        for (let f = 0; f < frames; f += LINE_INTERVAL) {
            const n = north()
            const axis = south().sub(n).radian()

            yield* remodel(this)
                .format("diamond")
                .r(10)
                .color(LINE_COLOR)
                .duplicate(LINE_WAYS, (b, i) => {
                    const angle = axis + T / 4 + (i - (LINE_WAYS - 1) / 2) * ((T / 2 - 0.6) / (LINE_WAYS - 1))
                    b.p = n.add(vec.arg(angle).scale(16))
                    return b
                })
                .g((me) => Magnet.line(me, north, south, LINE_SPEED, 900))
                .fire(this.game.bullets)

            yield* Array(LINE_INTERVAL)
        }
    }

    // 磁力線を湧かせては休む。合間に、赤と青の矢を自機へ
    private *cycle2() {
        const start = this.frame
        const north = this.pole(-1, start)
        const south = this.pole(1, start)
        const magnet = this.magnet

        this.addScript(() => Magnet.poles(this, north, south, () => true), { id: "poles" })

        while (true) {
            yield* GenUtils.all({
                lines: this.fieldLines(north, south, 200),
                arrows: (function* (me: EnemyByakko) {
                    for (let k = 0; k < 3; k++) {
                        yield* Array(70)
                        yield* remodel(me)
                            .format("arrow")
                            .r(18)
                            .p(me.p.clone())
                            .speed(0.5)
                            .aim(me.game.player.p)
                            .nway(3, T / 18)
                            .g((b, i) =>
                                GenUtils.all({
                                    accel: Behavior.accel(b, 50, 2.8),
                                    drift: magnet.drift(b, (k + i) % 2 === 0 ? 1 : -1),
                                }),
                            )
                            .fire(me.game.bullets)
                    }
                })(this),
            })

            yield* Array(140)
        }
    }

    // 磁力線と、赤と青の輪を重ねる
    private *cycle3() {
        const start = this.frame
        const north = this.pole(-1, start)
        const south = this.pole(1, start)

        this.addScript(() => Magnet.poles(this, north, south, () => true), { id: "poles" })

        while (true) {
            yield* GenUtils.all({
                lines: this.fieldLines(north, south, 180),
                rings: (function* (me: EnemyByakko) {
                    for (let k = 0; k < 3; k++) {
                        yield* Array(55)
                        yield* me.ring(k % 2 === 0 ? 1 : -1, 20, 2)
                    }
                })(this),
            })

            yield* Array(150)
        }
    }
}
