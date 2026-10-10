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
import { Charge } from "../Charge"
import { Size } from "../Size"

// 内側の円を六枚の甲羅が回り、外側の円を六つの子機(頭と五つの節)が等間隔のまま回る。
// 段は部位を落とすと進む。胴に攻撃が効くのは最後の段だけ。
// 一段目: 甲羅をすべて割ると次の段へ。胴はときどき輪を放つ。
// 二段目: 胴は水を集めて、小甲羅(孫機)に守られた子亀を二匹呼ぶ。子亀をすべて落とすと次の段へ。
//         胴は津波を起こす。画面の幅いっぱいの波を三列続けて押し寄せる。波には一か所だけ隙間があり、列ごとに少しずつずれる。
// 三段目: 胴だけになると、力を溜めてから攻撃が効くようになる。胴だけでも手強いよう、三つの攻撃を重ねる。
//         津波は四列になり、曲がりながら広がる六本腕の渦潮と、胴から四方へ伸びてゆっくり回る糸(レーザー)が加わる。

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
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 2, 3)

    // 甲羅(六枚)。胴を囲んで回る
    private readonly shells = [0, 1, 2, 3, 4, 5].map(
        (k) =>
            new Part(
                this.game,
                this,
                300,
                Size.M,
                (me) => vec.arg(me.frame / 50 + (T * k) / 6).scale(66),
                (me) => this.splash(me, k),
                150,
            ),
    )

    // 蛇の頭。外側の円を回る六つのうちの一つ
    private readonly snakeHead = new Part(
        this.game,
        this,
        600,
        Size.L,
        (me) => vec.arg(me.frame / 35).scale(140),
        (me) => this.fang(me),
        170,
    )

    // 蛇の節(五つ)。頭と合わせて六つが、外側の円に等間隔に並んで回る
    private readonly snakeBody = [0, 1, 2, 3, 4].map(
        (j) =>
            new Part(
                this.game,
                this,
                160,
                Size.S,
                (me) => vec.arg(me.frame / 35 + ((j + 1) * T) / 6).scale(140),
                (me) => this.drip(me, j),
                160,
            ),
    )

    readonly parts = [...this.shells, this.snakeHead, ...this.snakeBody]

    constructor(game: Game) {
        super(game, 2400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 220).add(this.home())
        yield
    }

    private *phases() {
        // 一段目: 甲羅をすべて割ると次の段へ
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.shells.some((p) => p.life > 0)) yield

        // 子亀。水を集めてから、小甲羅(孫機)に守られた子亀を呼ぶ
        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#90d0ff")

        const babies = [-1, 1].map((side) => {
            const baby = new Part(
                this.game,
                this,
                300,
                Size.M,
                () => vec(side * 120, 130),
                (me) => this.bubbles(me),
                60 + (side > 0 ? 50 : 0),
            )
            const smallShells = [0, 1, 2].map(
                (k) =>
                    new Part(
                        this.game,
                        baby,
                        80,
                        Size.S,
                        (me) => vec.arg(me.frame / 30 + (T * k) / 3).scale(60),
                        (me) => this.droplet(me, baby),
                        60 + k * 30,
                    ),
            )
            baby.guardedBy(smallShells)
            this.game.enemies.push(baby, ...smallShells)
            return baby
        })

        // 二段目: 子亀をすべて落とすと次の段へ。胴は津波を起こす
        this.scripts.add(() => this.tide(3), { loop: Infinity, margin: 90, id: "body" })
        while (babies.some((p) => p.life > 0)) yield

        // 三段目: 胴だけになると、力を溜めてから攻撃が効くようになる。四列の津波に、渦潮と糸を重ねる
        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#a0d8ff")
        this.isInvincible = false
        this.scripts.add(() => this.tide(4), { loop: Infinity, id: "body" })
        this.scripts.add(() => this.whirlpool(), { loop: Infinity, margin: 60, id: "whirlpool" })
        this.scripts.add(() => this.silk(), { loop: Infinity, margin: 120, id: "silk" })
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

    // 蛇の節の水滴。順に、だんだん速く真下へ落ちる水滴を垂らす
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

    // 子亀の泡。下へ向けて大きな泡を三つ吐く。泡はゆっくり出て、だんだん速くなる
    private *bubbles(me: Part) {
        yield* remodel(me)
            .format("big-ball")
            .color("#c0e8ff")
            .p(me.p.clone())
            .speed(1)
            .radian(T / 4)
            .nway(3, 0.4)
            .g((b) => Behavior.ease(b, "speed", 5, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(100)
    }

    // 小甲羅の水滴。子亀から見て外向きに、小さな水滴を二つ飛ばす
    private *droplet(me: Part, baby: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(5)
            .color("#b0e8ff")
            .p(me.p.clone())
            .speed(3.5)
            .radian(me.p.sub(baby.p).radian())
            .nway(2, 0.2)
            .fire(this.game.bullets)

        yield* Array(90)
    }

    // 一段目の胴。ときどき輪を放つ
    private *ring() {
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
    }

    // 津波。画面の幅いっぱいの波を rows 列続けて押し寄せる。隙間は一か所で、列ごとに少しずつずれる
    private *tide(rows: number) {
        const gap = this.game.WIDTH * (0.25 + 0.5 * this.random())
        // 隙間は画面の真ん中の方へずれていく(四列でも画面の外へ出ない)
        const drift = gap < this.game.WIDTH / 2 ? 45 : -45

        for (let k = 0; k < rows; k++) {
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
                .g((me) => Behavior.appear(me, 30))
                .g((b) => Behavior.ease(b, "speed", 5.5, 60, Ease.In))
                .fire(this.game.bullets)
            yield* Array(24)
        }

        yield* Array(150)
    }

    // 糸。胴から四方へ細い線が伸び、線のとおりに実体になってから、胴について回りながらゆっくり薙ぐ。回る向きは毎回変わる
    private *silk() {
        const turn = this.random() < 0.5 ? -0.008 : 0.008

        yield* remodel(this)
            .color("#e8f4ff")
            .laser(40, 60, this.p.clone(), this.p.add(vec.arg(this.random() * T).scale(1500)))
            .isScorable(false)
            .ex(4)
            .g(function* (b) {
                // 予告(30+40フレーム)と実体になる間(30フレーム)は向きを変えず、実体になってから回る
                for (let f = 0; f < 175; f++) {
                    b.p = this.p.clone()
                    if (f >= 100) b.radian += turn
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(260)
    }

    // 渦潮。曲がりながら広がる六本腕の渦。巻く向きは毎回変わる
    private *whirlpool() {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -0.012 : 0.012

        for (let f = 0; f < 60; f += 5) {
            yield* remodel(this)
                .format("diamond")
                .color("#a0d8ff")
                .p(this.p.clone())
                .speed(4)
                .radian(base + f * 0.02)
                .ex(6)
                .g((b) => Behavior.rotating(b, turn, 120))
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(150)
    }
}
