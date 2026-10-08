import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"

// ステージ「白虎」(二日前・巣の門)
// 白虎は、少し構えては素早く跳んで、画面の上の方を跳びまわる。
// 白虎のまわりに子機が幾何学的に並ぶ。胴を囲む正五角形に前脚の一対・後脚の一対・尾、胴の下の横一列に三匹の子虎。
// 前脚: 自機へ向けて、三本の爪痕を薄く見せてから、爪痕に沿って速い爪を走らせる。
// 後脚: 横へ風を蹴り出す。風は大きく弧を描いて、画面の両脇から下へ回り込む。
// 尾: 縞模様の帯を、何本も続けて振り下ろす。帯の弾の間は狭く、帯の端を回り込んでかわす。
// 子虎: 小さな輪を放つ。親の下に並んでいるので、親を狙った弾をさえぎる。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ(胴に攻撃が効かない間は、弾が胴を素通りしてうしろの尾にも届く)。
// 一段目: 前脚と尾を落とすと次の段へ。胴はときどき輪を放つ。
// 遠吠え: 白虎は立ち止まって遠吠えし、親の左右に一対の若虎を呼ぶ。
//         若虎のまわりを爪(孫機)が一つずつ回り、爪を落とすまで若虎に攻撃が効かない。
// 二段目: 若虎をすべて落とすと次の段へ。若虎は止まってから散る輪を放ち、爪は真下へ三本の爪痕を落とす。
//         胴は吠えるたびに、速さの違う三重の輪を放つ。
// 三段目: 疾風。胴に攻撃が効くようになる。白虎は構える時間が短くなり、跳んで着地するたびに衝撃の輪を放つ。

// 物語では、スズメバチの巣の門番として出る(二日前・山頂)
export default class extends Stage {
    *G() {
        yield* this.narrate("二日前。山頂。", "雪の匂いがする。", "岩の割れ目の奥から、低い羽音が聞こえる。")

        this.showFigure(Figure.hachinoko)
        this.showFigure(Figure.yukimushi)
        yield* this.talk("ユキムシ", "……ここだよ。")
        yield* this.talk("門番", "止まれ。", "蜜蜂? 一匹で?")
        yield* this.talk("門番", "その匂い。山の中腹の、杉の洞の巣か。")
        yield* this.talk("ハチノコ", "妹たちを、返して。")
        yield* this.talk("門番", "返せるものは、もう何もない。")
        this.hideAllFigures()

        const boss = new EnemyByakko(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure(Figure.hachinoko)
        yield* this.talk("門番", "……奥へは、行かせるな……。")
        yield* this.narrate("門の奥は、暗かった。")
        this.showFigure(Figure.yukimushi)
        yield* this.talk("ユキムシ", "あと二日。")
        this.hideAllFigures()
    }
}

class EnemyByakko extends Enemy {
    // 前脚(左右一対)。胴を囲む正五角形の、下の二つの角
    private readonly paws = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                24,
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
                20,
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
        18,
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
                14,
                () => vec((k - 1) * 60, 160),
                (me) => this.play(me),
                150 + k * 30,
            ),
    )

    // 落とさないと胴に攻撃が効かない部位
    private readonly guards = [...this.paws, this.tail]
    readonly parts = [...this.paws, ...this.hindLegs, this.tail, ...this.cubs]

    constructor(game: Game) {
        super(game, 1600, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16), 120)

        this.addScript(() => this.pounce(), { loop: Infinity, id: "move" })
    }

    private *phases() {
        // 一段目: 前脚と尾を落とすと次の段へ
        this.addScript(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        // 遠吠え。立ち止まって吠えてから、爪(孫機)に守られた若虎を呼ぶ
        this.removeScript("body")
        this.removeScript("move")
        yield* Charge.gather(this, 150, "#f0f0ff")
        this.addScript(() => this.pounce(), { loop: Infinity, id: "move" })

        const youngs = [-1, 1].map((side) => {
            const young = new Part(
                this.game,
                this,
                350,
                22,
                () => vec(side * 115, 60),
                (me) => this.youngRoar(me),
                60 + (side > 0 ? 50 : 0),
            )
            const claw = new Part(
                this.game,
                young,
                100,
                11,
                (me) => vec.arg(me.frame / 50 + (side > 0 ? 0 : Math.PI)).scale(28),
                (me) => this.scratch(me),
                80,
            )
            young.guardedBy([claw])
            this.game.enemies.push(young, claw)
            return young
        })

        // 二段目: 若虎をすべて落とすと次の段へ。胴は咆哮する
        this.addScript(() => this.roar(), { loop: Infinity, margin: 90, id: "body" })
        while (youngs.some((p) => p.life > 0)) yield

        // 三段目: 疾風。胴に攻撃が効くようになり、着地するたびに衝撃の輪を放つ
        this.removeScript("body")
        this.isInvincible = false
        this.game.camera.shake(8, 30)
        this.addScript(() => this.gale(), { loop: Infinity, id: "move" })
    }

    // 少し構えてから、画面の上の方の別の場所へ素早く跳ぶ
    private *pounce() {
        yield* Array(70)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.12 * this.random())),
            22,
        )
    }

    // 疾風。短く構えて素早く跳び、着地するたびに衝撃の輪を放つ
    private *gale() {
        yield* Array(40)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.32 + 0.36 * this.random()), this.game.HEIGHT * (0.1 + 0.14 * this.random())),
            16,
        )

        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(2)
            .radian(this.random() * T)
            .ex(24)
            .g((b) => Behavior.ease(b, "speed", 6, 30, Ease.In))
            .fire(this.game.bullets)
    }

    // 前脚の爪。自機へ向けて三本の爪痕を薄く見せてから、爪痕に沿って速い爪を走らせる
    private *claw(me: Part) {
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
            .shift(3, 24)
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
            .shift(3, 24)
            .fire(this.game.bullets)

        yield* Array(82)
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
            .duplicate(6)
            .delayByIndex(4)
            .nway(2, 0.25)
            .unbounded()
            .g(function* (b) {
                yield* Behavior.rotating(b, side * 0.045, 35)

                while (b.p.y < b.game.HEIGHT + 20) yield
                b.life = 0
            })
            .fire(this.game.bullets)

        yield* Array(150)
    }

    // 尾の縞。弾の間の狭い帯を、少しずつ向きを変えながら四本続けて振り下ろす
    private *stripes(me: Part) {
        const sway = (this.random() - 0.5) * 0.6

        for (let k = 0; k < 4; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#f0f0f0")
                .p(me.p.clone())
                .speed(4.5)
                .radian(T / 4 + sway + (k - 1.5) * 0.12)
                .shift(9, 24)
                .fire(this.game.bullets)
            yield* Array(14)
        }

        yield* Array(170)
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
            .ex(8)
            .g((b) => Behavior.ease(b, "speed", 5, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(90)
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
            .ex(14)
            .g((b) => Behavior.reaccel(b, 20, 20, 30, 5))
            .fire(this.game.bullets)

        yield* Array(110)
    }

    // 若虎の爪。真下へ三本の爪痕を落とす
    private *scratch(me: Part) {
        yield* remodel(me)
            .format("line")
            .color("#ffffff")
            .p(me.p.clone())
            .speed(3)
            .radian(T / 4)
            .duplicate(4)
            .delayByIndex(3)
            .shift(3, 16)
            .g((b) => Behavior.ease(b, "speed", 8, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(90)
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
            .ex(16)
            .fire(this.game.bullets)

        yield* Array(160)
    }

    // 咆哮。速さの違う三重の輪
    private *roar() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffffff")
            .p(this.p.clone())
            .radian(this.random() * T)
            .ex(22)
            .duplicate(3, (b, k) => {
                b.radian += (k * T) / 66
                b.speed = 3.5 + k
                return b
            })
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
