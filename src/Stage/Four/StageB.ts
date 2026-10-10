import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"
import { Size } from "../Size"

// 胴を囲む正五角形に前脚の一対・後脚の一対・尾、胴の下の横一列に三つの子機。胴は少し構えては素早く跳びまわる。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ。
// 一段目: 前脚と尾を落とすと次の段へ。
// 二段目: 胴は力を溜めて、爪(孫機)に守られた左右一対の子機を呼ぶ。子機を落とすと次の段へ。胴は三重の輪を放つ。
// 三段目: 発狂。胴だけになると、怒りを溜めてから、着地の衝撃の輪・前脚の爪・尾の縞・三重の輪を同時に使って暴れる。

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    // 前脚(左右一対)。胴を囲む正五角形の、下の二つの角
    private readonly paws = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                Size.L,
                () => vec.arg(T / 4 - (side * T) / 10).scale(100),
                (me) => this.claw(me),
                140 + (side > 0 ? 55 : 0),
            ),
    )

    // 後脚(左右一対)。正五角形の、横の二つの角
    private readonly hindLegs = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                350,
                Size.M,
                () => vec.arg(-T / 4 + (side * T) / 5).scale(100),
                (me) => this.wind(me, side),
                170 + (side > 0 ? 45 : 0),
            ),
    )

    // 尾。正五角形の、上の角
    private readonly tail = new Part(
        this.game,
        this,
        600,
        Size.L,
        () => vec(0, -100),
        (me) => this.stripes(me),
        200,
    )

    // 子虎(三匹)。胴の下に横一列に並ぶ
    private readonly cubs = [0, 1, 2].map(
        (k) =>
            new Part(
                this.game,
                this,
                180,
                Size.S,
                () => vec((k - 1) * 60, 160),
                (me) => this.play(me),
                150 + k * 30,
            ),
    )

    // 落とさないと胴に攻撃が効かない部位
    private readonly guards = [...this.paws, this.tail]
    readonly parts = [...this.paws, ...this.hindLegs, this.tail, ...this.cubs]

    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16), 120)

        this.scripts.add(() => this.pounce(), { loop: Infinity, id: "move" })
    }

    private *phases() {
        // 一段目: 前脚と尾を落とすと次の段へ
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        // 遠吠え。立ち止まって吠えてから、爪(孫機)に守られた若虎を呼ぶ
        this.scripts.remove("body")
        this.scripts.remove("move")
        yield* Charge.gather(this, 150, "#f0f0ff")
        this.scripts.add(() => this.pounce(), { loop: Infinity, id: "move" })

        const youngs = [-1, 1].map((side) => {
            const young = new Part(
                this.game,
                this,
                350,
                Size.M,
                () => vec(side * 115, 60),
                (me) => this.youngRoar(me),
                60 + (side > 0 ? 50 : 0),
            )
            const claw = new Part(
                this.game,
                young,
                100,
                Size.S,
                (me) => vec.arg(me.frame / 50 + (side > 0 ? 0 : Math.PI)).scale(60),
                (me) => this.scratch(me),
                80,
            )
            young.guardedBy([claw])
            this.game.enemies.push(young, claw)
            return young
        })

        // 二段目: 若虎をすべて落とすと次の段へ。胴は咆哮する
        this.scripts.add(() => this.roar(), { loop: Infinity, margin: 90, id: "body" })
        while (youngs.some((p) => p.life > 0)) yield

        // 三段目: 発狂。胴だけになると、怒りを溜めてから攻撃が効くようになり、四つの攻撃を同時に使って暴れる。
        // 短く構えては素早く跳び、着地のたびに衝撃の輪を放ちながら、落とした前脚の爪・尾の縞と、咆哮を自分で使う
        this.scripts.remove("body")
        this.scripts.remove("move")
        yield* Charge.gather(this, 120, "#ff7070")
        this.isInvincible = false
        this.scripts.add(() => this.gale(), { loop: Infinity, id: "move" })
        this.scripts.add(() => this.claw(this), { loop: Infinity, margin: 30, id: "claw" })
        this.scripts.add(() => this.stripes(this), { loop: Infinity, margin: 90, id: "stripes" })
        this.scripts.add(() => this.roar(), { loop: Infinity, margin: 60, id: "body" })
    }

    // 少し構えてから、画面の上の方の別の場所へ素早く跳ぶ
    private *pounce() {
        yield* Array(55)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.12 * this.random())),
            22,
        )
    }

    // 疾風。短く構えて素早く跳び、着地するたびに衝撃の輪を放つ
    private *gale() {
        yield* Array(20)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.14 * this.random())),
            12,
        )

        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(2)
            .radian(this.random() * T)
            .ex(40)
            .g((b) => Behavior.ease(b, "speed", 6.5, 30, Ease.In))
            .fire(this.game.bullets)
    }

    // 前脚の爪。自機へ向けて四本の爪痕を薄く見せてから、爪痕に沿って速い爪を走らせる
    private *claw(me: Enemy) {
        const start = me.p.clone()
        const aim = this.game.player.p.sub(start).radian()

        // 予告
        yield* remodel(me)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ffffff")
            .r(2)
            .speed(0)
            .p(start)
            .radian(aim)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .shift(4, 22)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.1, 8)
                yield* Array(20)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(28)

        // 攻撃
        yield* remodel(me)
            .format("line")
            .color("#ffffff")
            .p(start)
            .radian(aim)
            .speed(24)
            .duplicate(6)
            .delayByIndex(3)
            .shift(4, 22)
            .fire(this.game.bullets)

        yield* Array(62)
    }

    // 後脚の風。横へ蹴り出した風が、大きく弧を描いて下へ回り込む
    private *wind(me: Part, side: number) {
        yield* remodel(me)
            .format("small-ball")
            .r(6)
            .color("#d0e8ff")
            .p(me.p.clone())
            .speed(6.5)
            .radian(side > 0 ? 0 : Math.PI)
            .duplicate(8)
            .delayByIndex(4)
            .nway(3, 0.22)
            .unbounded()
            .g(function* (b) {
                yield* Behavior.rotating(b, side * 0.045, 35)

                while (b.p.y < b.game.HEIGHT + 20) yield
                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(120)
    }

    // 尾の縞。弾の間の狭い帯を、少しずつ向きを変えながら五本続けて振り下ろす
    private *stripes(me: Enemy) {
        const sway = (this.random() - 0.5) * 0.6

        for (let k = 0; k < 5; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#f0f0f0")
                .p(me.p.clone())
                .speed(5.5)
                .radian(T / 4 + sway + (k - 2) * 0.12)
                .shift(11, 24)
                .fire(this.game.bullets)
            yield* Array(14)
        }

        yield* Array(140)
    }

    // 子虎の小さな輪。だんだん速くなる
    private *play(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#fff0d0")
            .p(me.p.clone())
            .speed(1.5)
            .radian(this.random() * T)
            .ex(12)
            .g((b) => Behavior.ease(b, "speed", 5.5, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(75)
    }

    // 若虎の咆哮。止まってから散る輪
    private *youngRoar(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#f0f0ff")
            .p(me.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(20)
            .g((b) => Behavior.reaccel(b, 20, 20, 30, 5.5))
            .fire(this.game.bullets)

        yield* Array(90)
    }

    // 若虎の爪。真下へ三本の爪痕を落とす
    private *scratch(me: Part) {
        yield* remodel(me)
            .format("line")
            .color("#ffffff")
            .p(me.p.clone())
            .speed(3)
            .radian(T / 4)
            .duplicate(5)
            .delayByIndex(3)
            .shift(3, 16)
            .g((b) => Behavior.ease(b, "speed", 9, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }

    // 一段目の胴。ときどき輪を放つ
    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffffff")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(24)
            .fire(this.game.bullets)

        yield* Array(120)
    }

    // 咆哮。速さの違う三重の輪
    private *roar() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .radian(this.random() * T)
            .ex(28)
            .duplicate(3, (b, k) => {
                b.radian += (k * T) / 84
                b.speed = 3.5 + k
                return b
            })
            .fire(this.game.bullets)

        yield* Array(80)
    }
}
