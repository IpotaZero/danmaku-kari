import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"

// ステージ「青龍」(四天王)
// 青龍の頭のうしろに十の胴の節が連なり、頭の通った道をそのままたどって、画面の中ほどを大きくうねる。
// 宝珠: 頭のまわりを回る珠。自機の方へ三本の雷を落とす。雷は落ちる前に細い線で見える。宝珠を落とすまで、頭には攻撃が効かない。
// 胴の節: 頭から尾へ順に、体の両脇へ鱗を払う。龍がうねっているので、鱗はあちこちへ向かう。
// 頭: 宝珠があるうちは、ときどき輪を吐く。宝珠を落とすと、通った跡に雷を残すようになる。残った雷は少しして弾ける。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["空が……ごろごろ鳴ってる。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["よくぞ全ての道場を巡った。我は四天王が一、東の青龍。"], { name: "青龍" })
        yield* this.game.textBox.say(["この宝珠、奪えるものなら奪ってみよ。"], { name: "青龍" })
        this.hideFigure("hachinoko")

        const boss = new EnemySeiryu(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 宝珠が残っている間は、頭に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.pearl.life > 0
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……見事。宝珠も、我が身も、砕かれたか。"], { name: "青龍" })
        yield* this.game.textBox.say(["うねうね動くから、狙うのが大変だったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["南へ進め。朱雀が待っている。"], { name: "青龍" })
        this.hideFigure("hachinoko")
    }
}

class EnemySeiryu extends Enemy {
    // 頭がこれまでに通った位置。新しいものほど前にある
    private readonly trail: Vec[] = []

    // 宝珠。頭のまわりを回る
    readonly pearl = new Part(
        this.game,
        this,
        900,
        24,
        (me) => vec.arg(me.frame / 25).scale(60),
        (me) => this.thunder(me),
        150,
    )

    // 胴の節(十)。頭が 9(k+1) フレーム前にいた所にいる
    private readonly segments = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
        (k) =>
            new Part(
                this.game,
                this,
                200,
                18,
                () => (this.trail[(k + 1) * 9] ?? this.p).sub(this.p),
                (me) => this.scales(me, k),
                170,
            ),
    )

    readonly parts = [this.pearl, ...this.segments]

    constructor(game: Game) {
        super(game, 3000, 40, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move())
        this.addScript(() => this.breath(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    // 画面の中ほどを大きくうねる。通った位置を覚えておき、胴の節がそれをたどる
    private *move() {
        const path = Curves.lissajous(this.game.WIDTH * 0.7, this.game.HEIGHT * 0.3, 3, 2)

        for (let f = 0; ; f++) {
            this.p = path(f / 140).add(this.home())
            this.trail.unshift(this.p.clone())
            this.trail.length = Math.min(this.trail.length, 100)
            yield
        }
    }

    // 宝珠の雷。自機を狙った一本と、その両脇の二本。細い線で見えてから落ちる
    private *thunder(me: Part) {
        yield* remodel(me)
            .color("#c0f0ff")
            .laser(40, 20, me.p.clone(), me.p.add(this.game.player.p.sub(me.p).normalize().scale(1500)))
            .nway(3, 0.4)
            .fire(this.game.bullets)

        yield* Array(150)
    }

    // 胴の節の鱗。頭に近い節から順に、進む向きの両脇へ鱗を払う
    private *scales(me: Part, k: number) {
        yield* Array(k * 6)

        const before = me.p.clone()
        yield

        yield* remodel(me)
            .format("diamond")
            .color("#a0ffd0")
            .p(me.p.clone())
            .speed(1.5)
            .radian(me.p.sub(before).radian())
            .nway(2, T / 2)
            .nway(3, 0.22)
            .g((b) => Behavior.ease(b, "speed", 6, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(150 - k * 6)
    }

    // 頭の息。宝珠があるうちは輪を吐く。宝珠を落とすと、通った跡に雷を残す。残った雷は少しして弾ける
    private *breath() {
        if (this.pearl.life > 0) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#c0f0ff")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(20)
                .fire(this.game.bullets)

            yield* Array(150)
            return
        }

        for (let f = 0; f < 100; f += 4) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#e0f8ff")
                .p(this.p.clone())
                .speed(0)
                .radian(this.random() * T)
                .appear(10)
                .g(function* (b) {
                    yield* Array(45)
                    yield* Behavior.accel(b, 20, 4.5)
                })
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(60)
    }
}
