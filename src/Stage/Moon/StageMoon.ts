import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Puppet } from "./Puppet"

// ステージ「影絵」(月影道場・道場主)
// 道場主(月)のすぐそばで、小さな影絵の人形が形を作る。その影が画面の下の方へ何倍にも大きく映る。
// 影の輪郭は実体の弾で、内側は空っぽ。人形の小さな動きが、影では大きく素早い動きになるので、人形を見て影の動きを先読みする。
// 一段目: 狐。狐の口がゆっくり開き、震えたかと思うと、ぱくりと閉じる。口の中にいたら、閉じる前に外へ出る。
// 二段目: 鳥。大きな翼が上下に羽ばたいて、画面を薙ぐ。翼の付け根の近くほど、翼はゆっくり動く。
// 三段目: 兎。兎が跳ねるたびに月へ近づくので、影はふくらみながら下へ迫ってくる。体の輪郭の内側に入ってしまえば安全。
// 最終段: 影絵芝居。狐と鳥が同時に映る。
// どの段でも、道場主はときどき鈴の音(ゆっくりした輪)を鳴らす。

const ENTRANCE_FRAMES = 150
const BELL: Color = "#fff0b0"

// 狐の口の一回の動き。開く・震える・閉じる・閉じたまま
const OPEN_FRAMES = 90
const TREMBLE_FRAMES = 30
const SNAP_FRAMES = 10
const SHUT_FRAMES = 50
const BITE_FRAMES = OPEN_FRAMES + TREMBLE_FRAMES + SNAP_FRAMES + SHUT_FRAMES
const WIDE = 0.55
// 影が浮かび上がるまで(Puppet と同じ)
const INTRO_FRAMES = 50
// 鳥の羽ばたきの周期と角度
const FLAP_PERIOD = 110
const FLAP_ANGLE = 0.65
// 兎が跳ねる間隔と、跳んでいる時間・ふくらむ割合
const HOP_INTERVAL = 160
const HOP_FRAMES = 70
const HOP_GROW = 0.5
// 影を映し終えてからの休憩
const REST_FRAMES = 150

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["月が明るい……地面に、大きな影が。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["リーン……。今宵は影絵芝居をお目にかけましょう。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["影はね、小さな手の動きも大きく映すのですよ。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")

        const boss = new EnemySuzumushi(this.game)
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
        yield* this.game.textBox.say(["お粗末さまでした。"], { name: "スズムシ" })
        yield* this.game.textBox.say(["影なのに、本物よりこわかったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふふ。月影道場の免状を、どうぞ。"], { name: "スズムシ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemySuzumushi extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.12, this.game.HEIGHT * 0.02, 1, 2)

    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: ENTRANCE_FRAMES })
        yield

        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 90 })
        yield

        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 90 })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 影の光源(月=道場主)
    private light() {
        return () => this.p
    }

    // 鈴の音。ゆっくりした輪を interval ごとに count 回鳴らす
    private *bells(interval: number, count: number) {
        for (let k = 0; k < count; k++) {
            yield* Array(interval)
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color(BELL)
                .p(this.p.clone())
                .speed(1.5)
                .radian(this.random() * T)
                .ex(18)
                .fire(this.game.bullets)
        }
    }

    // 狐の口の開き。影が浮かび上がってから、開く→震える→ぱくり→閉じたまま をくり返す
    private bite(t: number) {
        const u = t - INTRO_FRAMES
        if (u < 0) return 0.05

        const v = u % BITE_FRAMES
        if (v < OPEN_FRAMES) return 0.05 + (WIDE - 0.05) * Ease.InOut(v / OPEN_FRAMES)
        if (v < OPEN_FRAMES + TREMBLE_FRAMES) return WIDE + 0.03 * Math.sin(v * 1.7)
        if (v < OPEN_FRAMES + TREMBLE_FRAMES + SNAP_FRAMES)
            return WIDE * (1 - (v - OPEN_FRAMES - TREMBLE_FRAMES) / SNAP_FRAMES) + 0.02
        return 0.02
    }

    private flap(t: number) {
        return FLAP_ANGLE * Math.sin((T * t) / FLAP_PERIOD)
    }

    // 狐。向きは周期ごとに左右を入れ替える
    private *cycle0() {
        for (const facing of [1, -1]) {
            const frames = INTRO_FRAMES + BITE_FRAMES * 3
            const shape = Puppet.fox(
                vec(-facing * 40, 470),
                0.85,
                facing,
                (t) => this.bite(t),
                (t) => vec(110 * Math.sin(t / 160), 30 * Math.sin(t / 110)),
            )

            yield* GenUtils.all({
                fox: Puppet.cast(this, this.light(), shape, frames),
                bells: this.bells(150, 3),
            })
            yield* Array(REST_FRAMES)
        }
    }

    // 鳥。左右にゆったり滑空しながら羽ばたく
    private *cycle1() {
        const frames = INTRO_FRAMES + FLAP_PERIOD * 5
        const shape = Puppet.bird(
            vec(0, 430),
            0.9,
            (t) => this.flap(t),
            (t) => vec(70 * Math.sin(t / 200), 40 * Math.sin(t / 130)),
        )

        yield* GenUtils.all({
            bird: Puppet.cast(this, this.light(), shape, frames),
            bells: this.bells(160, 3),
        })
        yield* Array(REST_FRAMES)
    }

    // 兎。跳ぶたびに左右へ移り、月へ近づいて影がふくらむ
    private *cycle2() {
        const hops = 4
        const frames = INTRO_FRAMES + HOP_INTERVAL * hops
        // n 回目の跳躍の左右の位置
        const sideOf = (n: number) => (n % 2 === 0 ? -1 : 1) * 100

        const shape = Puppet.rabbit(
            (t) => {
                const u = Math.max(0, t - INTRO_FRAMES)
                const n = Math.floor(u / HOP_INTERVAL)
                const v = Math.min(1, (u % HOP_INTERVAL) / HOP_FRAMES)
                return vec(sideOf(n) + (sideOf(n + 1) - sideOf(n)) * Ease.InOut(v), 440)
            },
            (t) => {
                const v = Math.max(0, t - INTRO_FRAMES) % HOP_INTERVAL
                return v < HOP_FRAMES ? 1 + HOP_GROW * Math.sin((Math.PI * v) / HOP_FRAMES) : 1
            },
            (t) => 0.25 * Math.sin(t / 12),
        )

        yield* GenUtils.all({
            rabbit: Puppet.cast(this, this.light(), shape, frames),
            bells: this.bells(180, 3),
        })
        yield* Array(REST_FRAMES)
    }

    // 狐と鳥を同時に。狐は左、鳥は右(周期ごとに入れ替える)
    private *cycle3() {
        for (const side of [-1, 1]) {
            const frames = INTRO_FRAMES + BITE_FRAMES * 3
            const fox = Puppet.fox(
                vec(side * 120, 520),
                0.6,
                -side,
                (t) => this.bite(t),
                (t) => vec(40 * Math.sin(t / 140), 20 * Math.sin(t / 90)),
            )
            const bird = Puppet.bird(
                vec(-side * 110, 330),
                0.6,
                (t) => this.flap(t + FLAP_PERIOD / 2),
                (t) => vec(50 * Math.sin(t / 170), 20 * Math.sin(t / 120)),
            )

            yield* GenUtils.all({
                fox: Puppet.cast(this, this.light(), fox, frames),
                bird: Puppet.cast(this, this.light(), bird, frames),
                bells: this.bells(140, 4),
            })
            yield* Array(REST_FRAMES)
        }
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 300 + (T / 3) * index).scale(110))
        this.isInvincible = true
    }
}
