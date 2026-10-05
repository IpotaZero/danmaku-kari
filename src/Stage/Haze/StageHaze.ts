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
import { Mirage } from "./Mirage"
import { Heat } from "./Heat"

// ステージ「陽炎」(陽炎道場・道場主)
// 一段目: 逃げ水。画面の真ん中を通る鏡に、道場主の揺らめく輪と矢が映る。鏡は周期ごとに傾きを変えて引き直される。
//   鏡が引かれる間(提示)に、幻がどこに映るか、つまり下からの弾がどこから来るかを読む。
// 二段目: 合わせ鏡。縦横の鏡で、道場主の矢が四つに映る。鏡の線から離れた部屋の真ん中で戦う。
// 三段目: 陽炎の柱。5本の泡の柱が下から昇る中へ、道場主がゆっくりした輪を落とす。
// 最終段: 蝉時雨。泡の柱が真ん中の鏡に映り、上からも降りてくる。上下から伸びた柱が真ん中でつながり、画面を縦に仕切る。

const ENTRANCE_FRAMES = 150
const COLOR: Color = "#ffb070"
const ARROW_COLOR: Color = "#ffe0b0"

const CYCLE0_FRAMES = 460
// 一段目の鏡を引くのにかかる時間と、鏡の傾きの範囲(水平からの角度)。
// 傾けすぎると幻が画面の外に映ってしまうので、水平に近い範囲で左右交互に傾ける
const DRAW_FRAMES = 100
const TILT_MIN = T / 60
const TILT_MAX = T / 20
const CYCLE1_FRAMES = 400
const CYCLE2_FRAMES = Heat.PLUME_TOTAL_FRAMES + 360
const CYCLE3_FRAMES = Heat.PLUME_TOTAL_FRAMES + 300

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        // yield* this.game.textBox.say(["あっつい……。景色がゆらゆらしてる。"], { name: "ハチノコ" })
        // yield* this.game.textBox.say(["ミーン、ミンミンミン……ようこそ陽炎道場へ!"], { name: "セミ" })
        // yield* this.game.textBox.say(["声おっきい!"], { name: "ハチノコ" })
        // yield* this.game.textBox.say(
        //     ["七年も土の中にいたんだ。そりゃ叫びたくもなるさ! さあ、見えてるものが全部本物とは限らないぞ!"],
        //     { name: "セミ" },
        // )
        this.hideFigure("hachinoko")

        const boss = new EnemyHaze(this.game)
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
        // yield* this.game.textBox.say(["ジジッ……。夏が、終わる……。"], { name: "セミ" })
        // yield* this.game.textBox.say(["大げさだなあ。"], { name: "ハチノコ" })
        // yield* this.game.textBox.say(["へへ、言ってみたかったんだ。ほら、陽炎道場の免状だよ!"], { name: "セミ" })
        // this.hideFigure("hachinoko")
        // this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        // yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        // yield* this.game.textBox.say(["次は流星道場だね。夜空を見上げるのを忘れずに!"], { name: "セミ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyHaze extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { id: "cycle", margin: 150 })
        yield

        this.showMirrors(Mirage.cross(this.game))
        this.addScript(() => this.cycle1(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.showMirrors([])
        this.addScript(() => this.cycle2(), { loop: Infinity, id: "cycle", margin: 150 })
        yield

        this.showMirrors([Mirage.horizontal(this.game)])
        this.addScript(() => this.cycle3(), { loop: Infinity, id: "cycle", margin: 150 })
        yield
    }

    // 鏡の線と、鏡に映った道場主の幻を描く。段が変わるたびに差し替える
    private showMirrors(mirrors: readonly Mirage.Mirror[]) {
        this.addScript(() => Mirage.lines(this, mirrors), { id: "mirror-lines" })
        this.addScript(() => Mirage.ghosts(this, mirrors), { id: "mirror-ghosts" })
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

    // 揺らめきながら広がる輪
    private ring(count: number, sign: number) {
        return remodel(this)
            .format("diamond")
            .color(COLOR)
            .p(this.p.clone())
            .speed(1.7)
            .radian(this.random() * T)
            .ex(count)
            .g(function* (me) {
                const base = me.radian

                for (let f = 0; ; f++) {
                    me.radian = base + sign * 0.35 * Math.sin(f / 20)
                    yield
                }
            })
    }

    // 最初はゆっくり、だんだん速くなる矢
    private arrows(way: number) {
        return remodel(this)
            .format("arrow")
            .color(ARROW_COLOR)
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(way, T / 24)
            .g((me) => Behavior.accel(me, 50, 3.6))
    }

    // 周期ごとに鏡を引き直し、引き終わったら揺らめく輪と矢を鏡に映して撃つ。前の鏡の傾きを覚えておくため、自分でくり返す
    private *cycle0() {
        let previous: Mirage.Mirror | undefined

        for (let side = this.random() < 0.5 ? -1 : 1; ; side *= -1) {
            const mirror: Mirage.Mirror = {
                center: Mirage.horizontal(this.game).center,
                angle: side * (TILT_MIN + this.random() * (TILT_MAX - TILT_MIN)),
            }

            const mirrors = [mirror]
            // スクリプトは次のフレームに始まるので、前の鏡は今のうちに取っておく
            const last = previous

            // 鏡を引く。幻は引き終わってから映る
            this.addScript(() => Mirage.draw(this, mirror, last, DRAW_FRAMES), { id: "mirror-lines" })
            this.addScript(() => Mirage.ghosts(this, mirrors), { id: "mirror-ghosts", margin: DRAW_FRAMES })
            previous = mirror

            yield* Array(DRAW_FRAMES + 20)

            for (let k = 0; k < 3; k++) {
                yield* this.ring(22, k % 2 === 0 ? 1 : -1)
                    .mirrorAll(mirrors)
                    .fire(this.game.bullets)
                yield* Array(40)
            }

            yield* this.arrows(5).mirrorAll(mirrors).fire(this.game.bullets)
            yield* Array(CYCLE0_FRAMES - DRAW_FRAMES - 20 - 120)
        }
    }

    private *cycle1() {
        const mirrors = Mirage.cross(this.game)

        yield* Array(60)

        for (let k = 0; k < 5; k++) {
            yield* this.arrows(3).mirrorAll(mirrors).fire(this.game.bullets)
            yield* Array(12)
        }

        yield* this.ring(12, 1).mirrorAll(mirrors).fire(this.game.bullets)
        yield* Array(CYCLE1_FRAMES - 120)
    }

    private *cycle2() {
        yield* GenUtils.all({
            plumes: Heat.plumes(this, 5, []),
            ring: (function* (me: EnemyHaze) {
                yield* Array(Heat.SEED_FRAMES + 40)
                yield* me.ring(18, 1).fire(me.game.bullets)
                yield* Array(80)
                yield* me.ring(18, -1).fire(me.game.bullets)
            })(this),
            wait: Array(CYCLE2_FRAMES),
        })
    }

    // 柱が鏡に映り、上からも降りてくる。上下の柱が真ん中でつながる間に、鏡に映る矢を撃つ
    private *cycle3() {
        const mirrors = [Mirage.horizontal(this.game)]

        yield* GenUtils.all({
            plumes: Heat.plumes(this, 3, mirrors),
            arrows: (function* (me: EnemyHaze) {
                yield* Array(Heat.SEED_FRAMES + 60)

                for (let k = 0; k < 3; k++) {
                    yield* me.arrows(3).mirrorAll(mirrors).fire(me.game.bullets)
                    yield* Array(50)
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
