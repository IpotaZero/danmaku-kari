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
import { Tiger } from "./Tiger"

// ステージ「白虎」(四天王)
// 一段目: 爪。自機のそばを、平行な3本の爪痕が薄く横切り、実体になる。爪痕の間に収まってやり過ごすと、爪痕は砕けて散る。
//   向きを変えて続けざまに引っかかれるので、前の爪痕と次の爪痕が重なってできる菱形の中へ移る。
// 二段目: 牙。自機を上下から挟むように牙が現れ、噛み合わさる。真ん中ほど早く閉じるので、横へ逃げる。
// 三段目: 咆哮。隙間が一つだけ開いた輪が次々に広がる。隙間は輪ごとに少しずつ回るので、隙間を追って回り込む。
// 最終段: 猛虎。咆哮の輪をくぐる間に、爪痕が走る。

const ENTRANCE_FRAMES = 150

const CLAW: Tiger.Claw = { gap: 52, spacing: 16, preview: 50, hold: 40 }
const FANG: Tiger.Fang = { width: 300, spacing: 20, open: 200, preview: 45, close: 50, hold: 30 }
const ROAR: Tiger.Roar = { count: 64, gap: 7, speed: 3, rings: 12, interval: 22, turn: T / 40 }
const FINAL_ROAR: Tiger.Roar = { ...ROAR, rings: 10, interval: 30 }

const CYCLE0_FRAMES = 520
const CYCLE1_FRAMES = 480
const CYCLE2_FRAMES = ROAR.rings * ROAR.interval + 300
const CYCLE3_FRAMES = FINAL_ROAR.rings * FINAL_ROAR.interval + 320

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……なにか、見られてる気がする。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["グルル……。四天王が三、西の白虎。"], { name: "白虎" })
        yield* this.game.textBox.say(["爪も牙も、狙うのは貴様の居場所そのもの。動かねば喰われるぞ。"], { name: "白虎" })
        this.hideFigure("hachinoko")

        const boss = new EnemyByakko(this.game)
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
        yield* this.game.textBox.say(["……我が爪をここまで躱すか。"], { name: "白虎" })
        yield* this.game.textBox.say(["食べられるのはいやだからね。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふん。北の玄武は我らの中で最も堅い。覚悟して行け。"], { name: "白虎" })
        this.hideFigure("hachinoko")
    }
}

class EnemyByakko extends Enemy {
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

    // 自機のそばを通る爪痕を引く。自機の真上を通るとは限らない
    private *claw(angle: number) {
        const near = this.game.player.p.add(vec.arg(this.random() * T).scale(this.random() * CLAW.gap))
        yield* Tiger.claw(this, near, angle, CLAW).fire(this.game.bullets)
    }

    // 向きを変えながら、3回続けて引っかく
    private *cycle0() {
        const base = this.random() * T

        for (let k = 0; k < 3; k++) {
            yield* this.claw(base + (k * T) / 3 + (this.random() - 0.5) * 0.3)
            yield* Array(70)
        }

        yield* Array(CYCLE0_FRAMES - 210)
    }

    // 自機を上下から挟んで噛む。噛むたびに、ゆっくりした矢を添える
    private *cycle1() {
        for (let k = 0; k < 2; k++) {
            const target = vec(
                Math.min(Math.max(this.game.player.p.x, 60), this.game.WIDTH - 60),
                Math.min(Math.max(this.game.player.p.y, this.game.HEIGHT * 0.4), this.game.HEIGHT - 40),
            )

            yield* Tiger.bite(this, target, FANG).fire(this.game.bullets)
            yield* Array(FANG.preview)

            yield* remodel(this)
                .format("arrow")
                .color(Tiger.COLOR)
                .p(this.p.clone())
                .speed(0.5)
                .aim(this.game.player.p)
                .nway(5, T / 24)
                .g((me) => Behavior.accel(me, 50, 3.2))
                .fire(this.game.bullets)

            yield* Array(FANG.close + FANG.hold + 70)
        }

        yield* Array(CYCLE1_FRAMES - 2 * (FANG.preview + FANG.close + FANG.hold + 70))
    }

    private *cycle2() {
        const direction = this.random() < 0.5 ? -1 : 1

        yield* Tiger.roar(this, this.game.player.p.sub(this.p).radian(), { ...ROAR, turn: ROAR.turn * direction })
        yield* Array(CYCLE2_FRAMES - ROAR.rings * ROAR.interval)
    }

    private *cycle3() {
        const direction = this.random() < 0.5 ? -1 : 1

        yield* GenUtils.all({
            roar: Tiger.roar(this, this.game.player.p.sub(this.p).radian(), {
                ...FINAL_ROAR,
                turn: FINAL_ROAR.turn * direction,
            }),
            claws: (function* (me: EnemyByakko) {
                yield* Array(60)
                yield* me.claw(me.random() * T)
                yield* Array(130)
                yield* me.claw(me.random() * T)
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
