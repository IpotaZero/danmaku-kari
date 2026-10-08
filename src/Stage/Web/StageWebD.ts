import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { SpiderWeb } from "./SpiderWeb"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"

// cycle3の巣。画面全体を覆う大きさにする(はみ出した糸は置かれない)。
// 糸を構成する弾の間隔は自機の当たり判定の8倍より狭いので、糸は抜けられない。網目の中で輪を避けることになる
const WEB: SpiderWeb.Config = {
    spokes: 12,
    rings: 16,
    ringGap: 64,
    spacing: 14,
    flightFrames: 90,
    landFrames: 45,
    solidFrames: 300,
}
// cycle3の1周期の長さ
const CYCLE3_FRAMES = 660

// ステージ「ジョロウグモ」(六日前・糸の藪)
// 卵を産み終えた母蜘蛛。妹たちがもう食われていることを、最初に面と向かって言う
export default class extends Stage {
    *G() {
        yield* this.narrate("六日前。糸の藪。", "枝から枝へ、黄色い糸が張りめぐらされている。")

        this.showFigure(Figure.hachinoko)
        this.showFigure(Figure.yukimushi)
        yield* this.talk("ハチノコ", "……見られてる。")
        yield* this.talk(
            "ジョロウグモ",
            "蜜蜂。ひさしぶり。",
            "夏のあいだは、あなたの姉さんたちが、よくかかってくれたわ。",
        )
        yield* this.talk("ハチノコ", "……。")
        yield* this.talk(
            "ジョロウグモ",
            "スズメバチの巣に行くんですってね。",
            "肉団子にされた子が、まだ生きてると思うの?",
        )
        yield* this.talk("ハチノコ", "……通して。")
        yield* this.talk("ジョロウグモ", "卵を産んだばかりで、お腹がすいてるの。")
        this.hideAllFigures()

        const boss = new EnemyBoss(this.game)
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

        this.showFigure(Figure.hachinoko)
        yield* this.talk("ジョロウグモ", "……ああ。もう、脚が動かない。")
        yield* this.talk(
            "ジョロウグモ",
            "いいの。卵は産んだ。あとは冬に任せるわ。",
            "あなたも、任せてしまえば楽なのに。",
        )
        yield* this.talk("ハチノコ", "行く。")
        this.showFigure(Figure.yukimushi)
        yield* this.talk("ユキムシ", "あと六日。")
        this.hideAllFigures()
    }
}

class EnemyBoss extends Enemy {
    constructor(game: Game) {
        super(game, 2400, 64, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        this.addScript(() => this.cycle0(), { loop: Infinity, id: "cycle", margin: 150 })
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
        yield* this.moveTo(this.home(), 120)
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *cycle0() {
        yield* this.randomMove(60)

        // 牙
        yield* GenUtils.repeat(4, () =>
            GenUtils.all({
                upper: remodel(this)
                    .scatter({ x: [this.game.WIDTH / 2 - 30, this.game.WIDTH / 2 + 30] })
                    .format("diamond")
                    .speed(1)
                    .radian(T / 4)
                    .shift(13, 60)
                    .scatter({ hue: [0, 360] })
                    .appear(30)
                    .g(function* (me) {
                        yield* Behavior.force(me, 0.1, 80)
                    })
                    .fire(this.game.bullets),

                lower: remodel(this)
                    .y(this.game.HEIGHT)
                    .scatter({ x: [this.game.WIDTH / 2 - 30, this.game.WIDTH / 2 + 30] })
                    .format("diamond")
                    .speed(1)
                    .radian(-T / 4)
                    .shift(13, 60)
                    .scatter({ hue: [0, 360] })
                    .appear(30)
                    .g(function* (me) {
                        yield* Behavior.force(me, 0.1, 80)
                    })
                    .fire(this.game.bullets),

                wait: Array(60),
            }),
        )

        yield* Array(120)

        for (let i = 0; i < 4; i++) {
            yield* this.randomMove(30)

            yield* remodel(this)
                .format("diamond")
                .colorful(this.frame)
                .p(this.p.clone())
                .aim(this.game.player)
                .speed(8)
                .ex(63)
                .g(function* (me) {
                    yield* Behavior.rotating(me, 0.01 * ((i % 2) * 2 - 1), 60)
                })
                .fire(this.game.bullets)
        }

        yield* this.randomMove(60)

        yield* Array(60)
    }

    private *cycle1() {
        yield* GenUtils.all({
            web: GenUtils.repeat(Infinity, () => this.cycle1_0()),
            fang: GenUtils.repeat(Infinity, () => this.cycle1_1()),
        })
    }

    private *cycle1_0() {
        for (let i = 0; i < 60; i++) {
            yield* remodel(this)
                .p(this.p.clone())
                .format("small-ball")
                .color("white")
                .radian(T / 4)
                .nway(2, ((Math.sin(T * (i / 60)) + 1) / 2) * (T / 15) + T / 30)
                .nway(7, T / 12)
                .speed(8)
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(60)
    }

    private *cycle1_1() {
        yield* this.randomMove(60)

        for (let i = 0; i < 16; i++) {
            yield* remodel(this)
                .p(this.p.clone())
                .format("diamond")
                .scatter({ p: 360, hue: [0, 360] })
                .aim(this.game.player)
                .shift(16, 120)
                .appear(30)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .fire(this.game.bullets)

            yield* Array(5)
        }

        yield* Array(360)
    }

    private *cycle2() {
        yield* GenUtils.repeat(4, () => this.cycle2_0())
        yield* Array(30)
        yield* this.moveTo(this.game.player.p, 45, 0.7)
        yield* this.cycle2_1()
        yield* this.randomMove(60)
    }

    private *cycle2_0() {
        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .aim(this.game.player)
            .duplicate(4)
            .speed(8)
            .delayByIndex(6)
            .nway(8, T / 129)
            .g(function* (me, _, __, j) {
                const radian = me.radian
                for (let i = 0; i < Infinity; i++) {
                    me.radian = radian + Math.cos(i / 36) * (T / 12) * (2 * (j % 2) - 1)
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* remodel(this)
            .format("arrow")
            .p(this.p.clone())
            .aim(this.game.player)
            .nway(4, T / 24)
            .scatter({ hue: [0, 360] })
            .g((me) => Behavior.accel(me, 60, 8))
            .fire(this.game.bullets)

        yield* Array(30)

        yield* remodel(this)
            .format("arrow")
            .p(this.p.clone())
            .aim(this.game.player)
            .nway(5, T / 24)
            .scatter({ hue: [0, 360] })
            .g((me) => Behavior.accel(me, 60, 8))
            .fire(this.game.bullets)

        yield* Array(30)
    }

    private *cycle2_1() {
        const radian = this.game.player.p.sub(this.p).radian()

        yield* remodel(this)
            .p(this.p.clone())
            .beam(250)
            .radian(radian)
            .nway(2, T / 6)
            .alpha(0)
            .g(function* (me, i) {
                yield* Behavior.fadein(me, 30)

                yield* GenUtils.all({
                    color: Behavior.hue(me, 180, 300, 50),
                    fang: Behavior.ease(me, "radian", radian, 50, Ease.InBack),
                })

                this.game.camera.shake(6, 16)

                yield* Behavior.fadeout(me, 30)
            })
            .fire(this.game.bullets)

        yield* Array(80)

        yield* remodel(this)
            .format("diamond")
            .p(this.p.clone())
            .duplicate(4)
            .delayByIndex(20)
            .duplicate(63)
            .scatter({ radian: [0, T], hue: [0, 360] })
            .speed(8)
            .g(function* (me) {
                yield* Behavior.accel(me, 120, 1)
                yield* Behavior.fadeout(me, 30)
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }

    // 画面全体に巣を張って自機を網目の中に閉じ込め、そこへ輪を撃ち込む。
    // 巣が消えてから次の巣を張るまでが休憩
    private *cycle3() {
        yield* this.randomMove(60)

        yield* GenUtils.all({
            web: this.cycle3_0(),
            ring: this.cycle3_1(),
            wait: Array(CYCLE3_FRAMES),
        })
    }

    // 画面の真ん中あたりを中心に、画面全体へ巣を編む。
    // 中心に近いほど網目が狭いので、編まれている間(提示)に、広い網目へ移っておく。
    // 動くとcycle3_1の移動とぶつかるので、ここでは動かない
    private *cycle3_0() {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        const center = vec(w * (0.3 + 0.4 * this.random()), h * (0.4 + 0.3 * this.random()))

        yield* SpiderWeb.weave(remodel(this), WEB, this.game, center, this.random() * T)
            .color("#f4f0ff")
            .fire(this.game.bullets)
    }

    private *cycle3_1() {
        yield* Array(WEB.flightFrames + WEB.landFrames + 30)

        for (let i = 0; i < 127; i++) {
            yield* remodel(this)
                .format("diamond")
                .colorful(this.frame * 2)
                .p(this.p.clone())
                .scatter({ p: 120 })
                .aim(this.game.player)
                .delayByIndex()
                .ex(31)
                .speed(12)
                .appear(30)
                .g((me) => Behavior.reaccel(me, 30, 30, 30))
                .fire(this.game.bullets)
            yield
        }
    }
}

class EnemyCore extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })
        this.setParent(parent, () => vec.arg(this.frame / 360 + (T / 3) * index).scale(100))
        this.isInvincible = true
    }
}
