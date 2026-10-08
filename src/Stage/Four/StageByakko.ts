import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"

// ステージ「白虎」(四天王)
// 白虎は、少し構えては素早く跳んで、画面の上の方を跳びまわる。三匹の子虎が、少し遅れて親のあとを追いかけてくる。
// 前脚: 自機へ向けて、三本の爪痕を薄く見せてから、爪痕に沿って速い爪を走らせる。
// 後脚: 横へ風を蹴り出す。風は大きく弧を描いて、画面の両脇から下へ回り込む。
// 尾: 縞模様の帯を、何本も続けて振り下ろす。帯の弾の間は狭く、帯の端を回り込んでかわす。
// 子虎: 親の下にじゃれついて、小さな輪を放つ。親の下にいるので、親を狙った弾をさえぎる。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ(胴に攻撃が効かない間は、弾が胴を素通りしてうしろの尾にも届く)。
// 一段目: 前脚と尾を落とすと次の段へ。胴はときどき輪を放つ。
// 遠吠え: 白虎は立ち止まって遠吠えし、二匹の若虎を呼ぶ。若虎は親の両脇を少し遅れて追いかける。
//         若虎は前脚に爪(孫機)を一本ずつ持ち、爪を落とすまで若虎に攻撃が効かない。
// 二段目: 若虎をすべて落とすと次の段へ。若虎は止まってから散る輪を放ち、爪は真下へ三本の爪痕を落とす。
//         胴は吠えるたびに、速さの違う三重の輪を放つ。
// 三段目: 疾風。胴に攻撃が効くようになる。白虎は構える時間が短くなり、跳んで着地するたびに衝撃の輪を放つ。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["白い影が、あっちこっちに跳んでる!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が三、西の白虎。こやつらは我が子らだ。"], { name: "白虎" })
        yield* this.game.textBox.say(["我が爪、見切れるものなら見切ってみよ。"], { name: "白虎" })
        this.hideFigure("hachinoko")

        const boss = new EnemyByakko(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……我が爪を、最後まで見切ったか。"], { name: "白虎" })
        yield* this.game.textBox.say(["子虎たち、かわいかったなあ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["ふん。北の玄武は我らの中で最も堅い。覚悟して行け。"], { name: "白虎" })
        this.hideFigure("hachinoko")
    }
}

class EnemyByakko extends Enemy {
    // 親がこれまでにいた位置。新しいものほど前にある。子虎と若虎はこれをたどって追いかける
    private readonly trail: Vec[] = []

    // 前脚(左右)
    private readonly paws = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                500,
                24,
                () => vec(side * 46, 46),
                (me) => this.claw(me),
                140 + (side > 0 ? 55 : 0),
            ),
    )

    // 後脚(左右)。胴の真後ろに隠れないよう、胴の幅より外に出す
    private readonly hindLegs = [-1, 1].map(
        (side) =>
            new Part(
                this.game,
                this,
                350,
                20,
                () => vec(side * 72, -24),
                (me) => this.wind(me, side),
                170 + (side > 0 ? 45 : 0),
            ),
    )

    // 尾。胴のうしろで、ゆらりと揺れる
    private readonly tail = new Part(
        this.game,
        this,
        600,
        18,
        (me) => vec(30 * Math.sin(me.frame / 18), -82),
        (me) => this.stripes(me),
        200,
    )

    // 子虎(三匹)。親が 12(k+1) フレーム前にいた所の、少し下を追いかける
    private readonly cubs = [0, 1, 2].map(
        (k) =>
            new Part(
                this.game,
                this,
                180,
                14,
                () => (this.trail[(k + 1) * 12] ?? this.p).add(vec((k - 1) * 52, 92)).sub(this.p),
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
        this.addScript(() => this.remember(), { loop: Infinity })
        this.addScript(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16), 120)

        this.addScript(() => this.pounce(), { loop: Infinity, id: "move" })
    }

    // いた位置を覚えておく
    private *remember() {
        this.trail.unshift(this.p.clone())
        this.trail.length = Math.min(this.trail.length, 40)
        yield
    }

    private *phases() {
        // 一段目: 前脚と尾を落とすと次の段へ
        this.addScript(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.guards.some((p) => p.life > 0)) yield

        // 遠吠え。立ち止まって吠えてから、爪(孫機)に守られた若虎を呼ぶ
        this.removeScript("body")
        this.removeScript("move")
        yield* Charge.gather(this, 150, "#f0f0ff")
        this.game.camera.shake(10, 40)
        this.addScript(() => this.pounce(), { loop: Infinity, id: "move" })

        const youngs = [-1, 1].map((side) => {
            const young = new Part(
                this.game,
                this,
                350,
                22,
                // 親の両脇の少しうしろを追いかける。画面の外へは出ない
                () => {
                    const anchor = this.trail[side > 0 ? 20 : 32] ?? this.p
                    return vec(Math.min(Math.max(anchor.x + side * 125, 40), this.game.WIDTH - 40), anchor.y + 40).sub(
                        this.p,
                    )
                },
                (me) => this.youngRoar(me),
                60 + (side > 0 ? 50 : 0),
            )
            const claw = new Part(
                this.game,
                young,
                100,
                11,
                () => vec(-side * 20, 30),
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
            vec(this.game.WIDTH * (0.2 + 0.6 * this.random()), this.game.HEIGHT * (0.1 + 0.12 * this.random())),
            22,
        )
    }

    // 疾風。短く構えて素早く跳び、着地するたびに衝撃の輪を放つ
    private *gale() {
        yield* Array(40)
        yield* this.moveTo(
            vec(this.game.WIDTH * (0.2 + 0.6 * this.random()), this.game.HEIGHT * (0.1 + 0.14 * this.random())),
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
                yield* Behavior.ease(b, "alpha", 0.2, 8)
                yield* Array(20)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(28)

        yield* remodel(me)
            .format("line")
            .color("#ffffff")
            .p(start)
            .radian(aim)
            .speed(10)
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

    // 子虎のじゃれ玉。小さな輪がだんだん速くなる
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
