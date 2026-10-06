import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Armor } from "./Armor"

// ステージ「反射装甲」(鉄壁道場・道場主)
// 道場主の装甲板は、撃ち込まれた弾を跳ね返す。板に当たった自機の弾は、敵の弾になって自分のいる方へ返ってくる。
// むやみに撃ち続けると自分の弾に追い詰められるので、板の隙間が道場主に向いたときだけ撃ち込む。撃つ・撃たないを選ぶ戦い。
// 敵の弾は板をすり抜ける(三段目の光弾だけは板で跳ね返る)。道場主の体力が減るごとに段が進む。
// 一段目: 双盾。二枚の板が道場主のまわりを回る。板の隙間から撃ち込む。
// 二段目: 鉄扉。道場主の前に左右二枚の扉が閉じる。扉が開いている間だけ撃ち込めるが、そこへは道場主の弾も飛んでくる。
// 三段目: 乱反射。宙に浮かぶ五枚の鏡がゆっくり回る。道場主の光弾は鏡で跳ね返って思わぬ向きから来る。自機の弾も鏡で跳ね返る。
// 最終段: 鉄壁。六枚の板が道場主を六角形に囲んで回る。ときどき六角形が広がって角に隙間が開く。

const ENTRANCE_FRAMES = 150
const LIFE = 6000
// 体力がこの割合を下回るたびに、次の段へ進む
const THRESHOLDS = [0.75, 0.5, 0.25]
const COLOR: Color = "#9ab8ff"
const BOUNCE_COLOR: Color = "#e0f0ff"

// 一段目
const SHIELD_RADIUS = 95
const SHIELD_HALF = 70
const SHIELD_PERIOD = 700
const CYCLE0_FRAMES = 300

// 二段目。扉の高さ・閉じている時間・開く(閉じる)のにかかる時間・開いている時間・開いたときの隙間
const DOOR_Y = 0.36
const CLOSED_FRAMES = 130
const SLIDE_FRAMES = 20
const OPEN_FRAMES = 80
const DOOR_GAP = 150

// 三段目
const MIRRORS = 5
const MIRROR_HALF = 46
const STREAM_FRAMES = 180
const CYCLE2_FRAMES = 320

// 最終段。六角形の大きさ(閉じたとき・開いたとき)と、それぞれの時間
const HEX_CLOSED = 112
const HEX_OPEN = 175
const HEX_HALF = 56
const HEX_PERIOD = 900

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ぴかぴかの鎧……顔が映りそう。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["映るだけではないぞ。撃ち込んだものは、そっくり返る。"], { name: "カブト" })
        yield* this.game.textBox.say(["闇雲に撃つな。撃つべき時を見極めよ。"], { name: "カブト" })
        this.hideFigure("hachinoko")

        const boss = new EnemyKabuto(this.game)
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
        yield* this.game.textBox.say(["見事な撃ち込みであった。"], { name: "カブト" })
        yield* this.game.textBox.say(["自分の弾に当たりそうになったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["はっはっは! 鉄壁道場の免状だ、受け取れ。"], { name: "カブト" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyKabuto extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.03, 1, 2)
    // いま構えている装甲板と、その段の番号(段が変わると前の板は消える)
    private plates: Armor.Plate[] = []
    private stance = 0

    constructor(game: Game) {
        super(game, LIFE, 56, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        this.addScript(() => this.shields(), { id: "plates", margin: ENTRANCE_FRAMES - 30 })
        yield

        // 扉と撃ち方は同じ周期で動くので、同時に始める
        this.addScript(() => this.doors(), { id: "plates", margin: 60 })
        this.addScript(() => this.cycle1(), { id: "cycle", margin: 60 })
        yield

        this.addScript(() => this.mirrors(), { id: "plates" })
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.hexagon(), { id: "plates", margin: 60 })
        this.addScript(() => this.cycle3(), { id: "cycle", margin: 60 })
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
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    // 装甲板を構え直す。前の段の板は消え、新しい板が自機の弾を跳ね返し始める。
    // 返す値は、この構えが続いているかどうか
    private equip(plates: Armor.Plate[]) {
        const stance = ++this.stance
        const alive = () => this.stance === stance && this.life > 0
        this.plates = plates

        for (const plate of plates) {
            this.addScript(() => Armor.build(this, plate, alive).fire(this.game.bullets))
        }
        this.addScript(() => Armor.guard(this, () => plates, alive))

        return alive
    }

    // 一段目。二枚の板が道場主のまわりを回る
    private *shields() {
        const plates = [0, 1].map(() => new Armor.Plate(this.p.clone(), 0, SHIELD_HALF))
        const alive = this.equip(plates)

        for (let f = 0; alive(); f++) {
            plates.forEach((plate, k) => {
                const angle = (T * f) / SHIELD_PERIOD + (k * T) / 2
                plate.center = this.p.add(vec.arg(angle).scale(SHIELD_RADIUS))
                plate.angle = angle + T / 4
            })
            yield
        }
    }

    // 二段目。左右の扉が閉じたり開いたりする。扉が閉じきると、画面の端から端まで板がつながる
    private *doors() {
        const w = this.game.WIDTH
        const y = this.game.HEIGHT * DOOR_Y
        const plates = [-1, 1].map((side) => new Armor.Plate(vec(w / 2 + (side * w) / 4, y), 0, w / 4))
        const alive = this.equip(plates)
        const cycle = CLOSED_FRAMES + SLIDE_FRAMES + OPEN_FRAMES + SLIDE_FRAMES

        for (let f = 0; alive(); f++) {
            const t = f % cycle
            const open =
                t < CLOSED_FRAMES
                    ? 0
                    : t < CLOSED_FRAMES + SLIDE_FRAMES
                      ? Ease.InOut((t - CLOSED_FRAMES) / SLIDE_FRAMES)
                      : t < CLOSED_FRAMES + SLIDE_FRAMES + OPEN_FRAMES
                        ? 1
                        : 1 - Ease.InOut((t - CLOSED_FRAMES - SLIDE_FRAMES - OPEN_FRAMES) / SLIDE_FRAMES)

            plates.forEach((plate, k) => {
                const side = k === 0 ? -1 : 1
                plate.center = vec(w / 2 + side * (w / 4 + (open * DOOR_GAP) / 2), y)
            })
            yield
        }
    }

    // 三段目。五枚の鏡が宙に浮かび、それぞれの速さでゆっくり回る
    private *mirrors() {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        const plates = Array.from(
            { length: MIRRORS },
            (_, k) =>
                new Armor.Plate(
                    vec((w * (k + 0.5)) / MIRRORS, h * (0.36 + 0.14 * (k % 2))),
                    this.random() * T,
                    MIRROR_HALF,
                ),
        )
        const spins = plates.map((_, k) => ((k % 2 === 0 ? 1 : -1) * T) / (500 + 150 * k))
        const alive = this.equip(plates)

        while (alive()) {
            plates.forEach((plate, k) => {
                plate.angle += spins[k]
            })
            yield
        }
    }

    // 最終段。六枚の板が六角形に道場主を囲んで回り、ときどき広がって角に隙間が開く。
    // 開いている間は、角の隙間から外へ向けて弾の筋を撃つ(隙間の向きを知っているのは板なので、ここで撃つ)
    private *hexagon() {
        const plates = Array.from({ length: 6 }, () => new Armor.Plate(this.p.clone(), 0, HEX_HALF))
        const alive = this.equip(plates)

        for (let f = 0; alive(); f++) {
            const open = this.breath(f)
            const radius = HEX_CLOSED + (HEX_OPEN - HEX_CLOSED) * open
            const turn = (T * f) / HEX_PERIOD

            plates.forEach((plate, k) => {
                const angle = turn + (T * k) / 6
                // 六角形の辺の真ん中は、中心から radius * cos(30度) の所
                plate.center = this.p.add(vec.arg(angle).scale(radius * Math.cos(T / 12)))
                plate.angle = angle + T / 4
            })

            if (open === 1 && f % 6 === 0) {
                yield* remodel(this)
                    .format("diamond")
                    .color(COLOR)
                    .p(this.p.clone())
                    .speed(3.4)
                    .radian(turn + T / 12)
                    .ex(6)
                    .fire(this.game.bullets)
            }

            yield
        }
    }

    // 最終段で、六角形がどれだけ広がっているか(0で閉じている、1で開ききっている)。
    // 閉じている150フレーム→広がる30→開いている90→閉じる30 をくり返す
    private breath(f: number) {
        const t = f % 300
        if (t < 150) return 0
        if (t < 180) return Ease.InOut((t - 150) / 30)
        if (t < 270) return 1
        return 1 - Ease.InOut((t - 270) / 30)
    }

    private *ring(count: number, speed: number) {
        yield* remodel(this)
            .format("donut")
            .color(COLOR)
            .p(this.p.clone())
            .speed(speed)
            .radian(this.random() * T)
            .ex(count)
            .fire(this.game.bullets)
    }

    private *arrows(way: number, spread: number) {
        yield* remodel(this)
            .format("arrow")
            .color("#ffe0a0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(way, spread)
            .g((me) => Behavior.accel(me, 50, 3.4))
            .fire(this.game.bullets)
    }

    private *cycle0() {
        yield* Array(40)
        yield* this.ring(28, 1.6)
        yield* Array(120)
        yield* this.arrows(5, T / 24)
        yield* Array(CYCLE0_FRAMES - 160)
    }

    // 扉の動きに合わせて撃つ。閉じている間は輪(扉をすり抜ける)、開いている間は隙間へ矢を通す。
    // 扉の動きと同じ周期で、自分でくり返す
    private *cycle1() {
        while (true) {
            yield* Array(30)
            yield* this.ring(24, 1.8)
            yield* Array(60)
            yield* this.ring(24, 1.8)
            yield* Array(CLOSED_FRAMES + SLIDE_FRAMES - 90)

            for (let k = 0; k < 3; k++) {
                yield* this.arrows(3, T / 30)
                yield* Array(Math.floor(OPEN_FRAMES / 3))
            }

            yield* Array(SLIDE_FRAMES)
        }
    }

    // 六方向へ回る光弾の筋。光弾は鏡で二回まで跳ね返る
    private *cycle2() {
        const base = this.random() * T
        const turn = (this.random() < 0.5 ? -1 : 1) * (T / 600)
        const plates = this.plates

        for (let f = 0; f < STREAM_FRAMES; f += 8) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color(BOUNCE_COLOR)
                .p(this.p.clone())
                .speed(3)
                .radian(base + turn * f)
                .ex(6)
                .g((me) => Armor.bounce(me, () => plates, 2))
                .fire(this.game.bullets)
            yield* Array(8)
        }

        yield* Array(CYCLE2_FRAMES - STREAM_FRAMES)
    }

    // 六角形が閉じている間に、輪と矢を撃つ(開いている間の筋は hexagon が撃つ)。六角形の呼吸と同じ周期で、自分でくり返す
    private *cycle3() {
        while (true) {
            yield* Array(30)
            yield* this.ring(30, 1.7)
            yield* Array(60)
            yield* this.arrows(3, T / 30)
            yield* Array(300 - 90)
        }
    }
}
