import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"

// ステージ「玄武」(四天王)
// 玄武は、蛇の巻きついた大亀。胴のまわりを六枚の甲羅が回り、そのまわりを蛇がとぐろを巻いて這いまわる。
// 甲羅: 胴を囲んで回りながら、順に外向きの水弾を放つ。甲羅が胴を囲んでいるので、胴を狙った弾は甲羅に当たる。
// 蛇の頭: 亀のまわりを速く回りながら、自機へ毒牙(針の三方向)を飛ばす。
// 蛇の胴: 頭のあとに続いて回りながら、順に水滴を垂らす。水滴はだんだん速く真下へ落ちる。
// 亀の胴: 甲羅をすべて割るまで攻撃が効かない。甲羅を割ると、画面の幅いっぱいの波を三列続けて押し寄せる。
//         波には一か所だけ隙間があり、列ごとに少しずつずれる。隙間をたどってくぐり抜ける。

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["足もとが水びたし……つめたい。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が四、北の玄武。水の底より来る者。"], { name: "玄武" })
        yield* this.game.textBox.say(["我が甲羅、割れるものなら割ってみよ。"], { name: "玄武" })
        this.hideFigure("hachinoko")

        const boss = new EnemyGenbu(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 甲羅が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.shells.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["見事なり。四天王、すべて破れたか。"], { name: "玄武" })
        yield* this.game.textBox.say(["蛇がぐるぐる回ってて、目が回ったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["この先に、すべての道場の頂がいる。最後の試練だ。"], { name: "玄武" })
        this.hideFigure("hachinoko")
    }
}

class EnemyGenbu extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 2, 3)

    // 甲羅(六枚)。胴を囲んで回る
    readonly shells = [0, 1, 2, 3, 4, 5].map(
        (k) =>
            new Part(
                this.game,
                this,
                300,
                22,
                (me) => vec.arg(me.frame / 50 + (T * k) / 6).scale(58),
                (me) => this.splash(me, k),
                150,
            ),
    )

    // 蛇の頭。亀のまわりを速く這いまわる
    private readonly snakeHead = new Part(
        this.game,
        this,
        600,
        20,
        (me) => vec.arg(me.frame / 35).scale(125 + 15 * Math.sin(me.frame / 10)),
        (me) => this.fang(me),
        170,
    )

    // 蛇の胴(五節)。頭のあとに続いて、波打ちながら回る
    private readonly snakeBody = [0, 1, 2, 3, 4].map(
        (j) =>
            new Part(
                this.game,
                this,
                160,
                14,
                (me) =>
                    vec.arg(me.frame / 35 - (j + 1) * 0.28).scale(125 + 15 * Math.sin(me.frame / 10 - (j + 1) * 0.8)),
                (me) => this.drip(me, j),
                160,
            ),
    )

    readonly parts = [...this.shells, this.snakeHead, ...this.snakeBody]

    constructor(game: Game) {
        super(game, 3000, 44, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.tide(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 220).add(this.home())
        yield
    }

    // 甲羅の水弾。k 番目の甲羅は 8k フレーム待ってから、胴から外向きに五方向の水弾を放つ
    private *splash(me: Part, k: number) {
        yield* Array(k * 8)

        yield* remodel(me)
            .format("big-ball")
            .r(10)
            .color("#90d0ff")
            .p(me.p.clone())
            .speed(1.5)
            .radian(me.p.sub(this.p).radian())
            .nway(5, 0.22)
            .g((b) => Behavior.ease(b, "speed", 6, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(120 - k * 8)
    }

    // 蛇の毒牙。自機へ向けて三方向の針
    private *fang(me: Part) {
        yield* remodel(me)
            .format("line")
            .color("#c0ffb0")
            .p(me.p.clone())
            .speed(2)
            .aim(this.game.player)
            .nway(3, T / 30)
            .g((b) => Behavior.ease(b, "speed", 8.5, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(55)
    }

    // 蛇の胴の水滴。頭に近い節から順に、だんだん速く真下へ落ちる水滴を垂らす
    private *drip(me: Part, j: number) {
        yield* Array(j * 10)

        yield* remodel(me)
            .format("small-ball")
            .r(6)
            .color("#b0e8ff")
            .p(me.p.clone())
            .speed(0.5)
            .radian(T / 4)
            .nway(2, 0.3)
            .g((b) => Behavior.ease(b, "speed", 6.5, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(90 - j * 10)
    }

    // 亀の胴の波。甲羅があるうちは、ときどき輪を放つ。
    // 甲羅を割ると、画面の幅いっぱいの波を三列続けて押し寄せる。隙間は一か所で、列ごとに少しずつずれる
    private *tide() {
        if (this.shells.some((p) => p.life > 0)) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .color("#90d0ff")
                .p(this.p.clone())
                .speed(3.5)
                .radian(this.random() * T)
                .ex(16)
                .fire(this.game.bullets)

            yield* Array(160)
            return
        }

        const gap = this.game.WIDTH * (0.25 + 0.5 * this.random())
        const drift = this.random() < 0.5 ? -50 : 50

        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#70b8ff")
                .speed(3)
                .radian(T / 4)
                .duplicate(22, (b, i) => {
                    b.p = vec(((i + 0.5) * this.game.WIDTH) / 22, this.p.y + 40)
                    return b
                })
                .filter((b) => Math.abs(b.p.x - (gap + k * drift)) > 45)
                .g((b) => Behavior.ease(b, "speed", 5.5, 60, Ease.In))
                .fire(this.game.bullets)
            yield* Array(24)
        }

        yield* Array(150)
    }
}
