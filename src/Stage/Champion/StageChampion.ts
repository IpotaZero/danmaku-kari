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
import { Charge } from "../Charge"
import { Size } from "../Size"

// ステージ「チャンピオン」
// チャンピオンのまわりに子機が幾何学的に並ぶ。胴を囲む翅、胴の前の横一列に大顎の一対と毒針、胴の左右の横一列に六つの脚。
// そのまわりの大きな楕円を、働き蜂がそろって回る。それぞれが別々の攻撃をする。
// 大顎: 横へ開いた弾が一度止まり、自機のいた所へ一斉に噛みつく。左右の大顎が交互に噛みつく。
// 翅: 羽音。くねくねと揺れながら進む弾の列を流す。
// 脚: 左の脚から右の脚へ順に、だんだん速くなる爪を落とす。爪が幕のように左から右へ降りていく。
// 毒針: 自機の方へ扇のように線を薄く見せてから、端から順に線に沿って針を撃ち込む。
// 働き蜂: 大きな楕円を速く回り、進む向きへ短い弾の列を撃つ。
// 段は部位を落とすと進む。
//   一代目: 胴を囲む正方形の四枚の翅を落とすと、胴に攻撃が効くようになり、女王の怒り(向きを変えながら回る渦)を撒く。
//   再生: 一代目が完全に倒れると、初雪が降りはじめ、倒れた所に卵が現れる。卵は温まりきる(充電が満ちる)まで何もせず、撃っても割れない。
//         撃つほど早く温まる。孵る瞬間、画面が光り、生まれた二代目は輪を放ちながら舞い上がる。
//   二代目: どの部位の攻撃も一段激しくなる。翅は胴を囲む正六角形の六枚になって回る。
//           翅を落とすと、胴は力を溜めて、まわりを回る六つの親衛隊を呼ぶ。親衛隊を落とすと、胴に攻撃が効くようになる。
//           最後の段では、胴の左右から光の線(ビーム)が伸びて上下二段の光の翅になり、上の翅と下の翅が互い違いに羽ばたく。
//           翅は薄く伸びて形を見せてから実体になる。羽ばたき終えると消え、少し休んでからまた広げる。
//           二代目は初雪の中で戦う。雪は当たり判定のある、ゆっくり揺れながら落ちる弾。精密に避けている最中に、ばらばらな雪が混ざってくる。

export default class extends Stage {
    *G() {
        // 一代目
        const first = new EnemyHornet(this.game, 0, vec(-200, -200))
        this.game.enemies.push(first, ...first.parts)

        let from = first.p.clone()
        while (first.life > 0) {
            from = first.p.clone()
            yield
        }

        yield* this.waitAllEnemiesDead()

        // 一代目が完全に倒れると、初雪が降りはじめる。一年が冬へ戻っていく。画面の弾を花粉に変えて、一息つかせる
        this.scorenizeAllBullets()
        this.flash("#eef6ffc0", 40)
        this.scripts.add(() => this.quietSnow(), { loop: Infinity })

        // 倒れた所に卵が現れ、温まりきると孵る
        yield* Array(40)
        this.game.enemies.push(new EnemyEgg(this.game, from))
        yield* this.waitAllEnemiesDead()

        // 二代目は初雪の中で戦う
        const second = new EnemyHornet(this.game, 1, from)
        this.game.enemies.push(second, ...second.parts)
        second.snow()

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }

    // 当たり判定のない雪。戦いの雪よりずっと小さく薄くして、弾と見分けがつくようにする
    private *quietSnow() {
        yield* remodel(this.game.player)
            .type("effect")
            .appearance("ball")
            .r(2)
            .color("#eef6ff")
            .alpha(0.3)
            .speed(1)
            .radian(T / 4)
            .p(vec(Math.random() * this.game.WIDTH, 0))
            .fire(this.game.bullets)

        yield* Array(8)
    }
}

// 一代目が倒れた所に現れる卵。温まりきる(充電が満ちる)まで何もせず、撃っても割れない。撃つほど早く温まる。
class EnemyEgg extends Enemy {
    constructor(game: Game, p: Vec) {
        super(game, 1, Size.L, { charge: 100 })
        this.p = p.clone()

        this.scripts.add(() => this.hatch())
    }

    // 温まりきると孵る
    private *hatch() {
        this.life = 0
        yield
    }
}

class EnemyHornet extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.07, 2, 3)

    // 翅。一代目は胴を囲む正方形の四枚、二代目は胴を囲んで回る正六角形の六枚
    private readonly wings: Part[]
    readonly parts: Part[]

    constructor(game: Game, generation: number, from: Vec) {
        super(game, generation === 0 ? 2400 : 2800, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = from.clone()

        const mandibles = [-1, 1].map((side) => new Mandible(this.game, this, side, generation))

        this.wings =
            generation === 0
                ? [
                      [-1, 0],
                      [1, 0],
                      [-1, 1],
                      [1, 1],
                  ].map(([side, row]) => new SquareWing(this.game, this, side, row, generation))
                : [0, 1, 2, 3, 4, 5].map((i) => new HexWing(this.game, this, i, generation))

        const legs = [-3, -2, -1, 1, 2, 3].map((x, order) => new Leg(this.game, this, x, order, generation))
        const stinger = new Stinger(this.game, this, generation)

        // 一代目は六匹、二代目は八匹
        const workers = Array.from({ length: generation === 0 ? 6 : 8 }, (_, i) => i).map(
            (i, _, all) => new Worker(this.game, this, i, all.length, generation),
        )

        this.parts = [...mandibles, ...this.wings, ...legs, stinger, ...workers]

        this.scripts.add(() => this.enter(generation))
        this.scripts.add(() => this.phases(generation))
    }

    // 一代目は画面の外から飛んでくる。二代目は、卵の孵った所で輪を放ちながら舞い上がる
    private *enter(generation: number) {
        if (generation > 0) {
            yield* Charge.burst(this, "#ffd060")
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffe0a0")
                .p(this.p.clone())
                .speed(1.5)
                .radian(this.random() * T)
                .ex(36)
                .g((b) => Behavior.ease(b, "speed", 5.5, 40, Ease.In))
                .fire(this.game.bullets)
        }

        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 180).add(this.home())
        yield
    }

    private *phases(generation: number) {
        // 翅を落とすまで、胴に攻撃が効かない。胴はときどき輪を放つ
        this.scripts.add(() => this.ring(generation), { loop: Infinity, margin: 180, id: "body" })
        while (this.wings.some((p) => p.life > 0)) yield

        // 二代目は、翅を落とすと力を溜めて、まわりを回る六つの親衛隊を呼ぶ
        if (generation > 0) {
            this.scripts.remove("body")
            yield* Charge.gather(this, 150, "#ffd060")

            const escorts = [0, 1, 2, 3, 4, 5].map((i) => new Escort(this.game, this, i))
            this.game.enemies.push(...escorts)
            this.scripts.add(() => this.ring(generation), { loop: Infinity, margin: 60, id: "body" })

            while (escorts.some((p) => p.life > 0)) yield
        }

        // 胴に攻撃が効くようになり、女王の怒りを撒く。二代目は光の翅も広げる
        this.scripts.remove("body")
        yield* Charge.gather(this, 120, "#ffb040")
        this.isInvincible = false
        this.scripts.add(() => this.fury(generation), { loop: Infinity, id: "body" })
        if (generation > 0) this.scripts.add(() => this.lightWings(), { loop: Infinity, margin: 60, id: "wings" })
    }

    // 翅があるうちの胴の輪。二代目は一度止まってから散る、濃い輪になる
    private *ring(generation: number) {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffd060")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(20 + generation * 8)
            .g((b) => (generation > 0 ? Behavior.reaccel(b, 20, 15, 30, 5) : Behavior.accel(b, 1, 3.5)))
            .fire(this.game.bullets)

        yield* Array(150 - generation * 20)
    }

    // 女王の怒り。向きを変えながら回る渦。一代目は七本腕、二代目は九本腕
    private *fury(generation: number) {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 80; f += 4) {
            yield* remodel(this)
                .format("diamond")
                .color("#ffb040")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * 0.6 * Math.sin(f / 25))
                .ex(7 + generation * 2)
                .fire(this.game.bullets)
            yield* Array(4)
        }

        yield* Array(70 - generation * 10)
    }

    // 光の翅。胴の左右から光の線が薄く伸びて上下二段の翅の形を見せ、実体になってから羽ばたく。
    // 上の翅(左右四本ずつ)と下の翅(左右三本ずつ)は互い違いに、ゆっくり二度羽ばたく(一度に約5秒)。羽ばたき終えると消え、少し休んでからまた広げる
    private *lightWings() {
        // 上の翅。水平より少し上に広がり、水平のあたりまで振り下ろす
        yield* remodel(this)
            .beam(0)
            .color("#e8f0ff")
            .duplicate(8, (b, i) => {
                b.radian = i < 4 ? -0.35 + (i - 1.5) * 0.1 : Math.PI + 0.35 - (i - 5.5) * 0.1
                return b
            })
            .g(function* (b) {
                const base = b.radian
                const side = Math.cos(base) > 0 ? 1 : -1

                b.type = "neutral"
                b.alpha = 0.25
                yield* Behavior.ease(b, "length", 700, 60, Ease.Out)
                b.type = "enemy"
                b.alpha = 1

                for (let f = 0; f < 630; f++) {
                    b.radian = base + side * 0.4 * Math.sin(f / 50)
                    yield
                }

                yield* Behavior.fadeout(b, 30)
            })
            .fire(this.game.bullets)

        // 下の翅。水平より下に広がり、上の翅と互い違いに羽ばたく
        yield* remodel(this)
            .beam(0)
            .color("#ffd060")
            .duplicate(6, (b, i) => {
                b.radian = i < 3 ? 0.55 + (i - 1) * 0.1 : Math.PI - 0.55 - (i - 4) * 0.1
                return b
            })
            .g(function* (b) {
                const base = b.radian
                const side = Math.cos(base) > 0 ? 1 : -1

                b.type = "neutral"
                b.alpha = 0.25
                yield* Behavior.ease(b, "length", 700, 60, Ease.Out)
                b.type = "enemy"
                b.alpha = 1

                for (let f = 0; f < 630; f++) {
                    b.radian = base - side * 0.3 * Math.sin(f / 50)
                    yield
                }

                yield* Behavior.fadeout(b, 30)
            })
            .fire(this.game.bullets)

        // 伸びる(60) + 羽ばたく(630) + 消える(30) のあと、3秒休む
        yield* Array(900)
    }

    // 初雪。画面の上から、ゆっくり左右に揺れながら雪が降りはじめ、倒れるまで降り続ける
    snow() {
        this.scripts.add(() => this.snowfall(), { loop: Infinity })
    }

    private *snowfall() {
        yield* remodel(this)
            .format("small-ball")
            .color("#eef6ff")
            .speed(1.4)
            .duplicate(2, (b) => {
                b.p = vec(this.random() * this.game.WIDTH, 0)
                return b
            })
            .appear(20)
            .g(function* (b) {
                const phase = this.random() * T
                for (let f = 0; ; f++) {
                    b.radian = T / 4 + 0.35 * Math.sin(f / 40 + phase)
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(18)
    }
}

// 女王蜂の攻撃のうち、いくつかの部位が使うもの
namespace Hornet {
    // 翅の羽音。くねくね揺れながら進む弾の列を、radian の向きへ流す
    export function* buzz(me: Enemy, radian: number, generation: number) {
        for (let k = 0; k < 10 + generation * 2; k++) {
            yield* remodel(me)
                .format("small-ball")
                .r(5)
                .color("#e8f0ff")
                .p(me.p.clone())
                .speed(4.5)
                .radian(radian)
                .g(function* (b) {
                    const base = b.radian
                    for (let f = 0; ; f++) {
                        b.radian = base + 0.6 * Math.sin(f / 5)
                        yield
                    }
                })
                .fire(me.game.bullets)
            yield* Array(4)
        }

        yield* Array(130)
    }
}

// 大顎(左右一対)。胴の前の横一列の両端
class Mandible extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly generation: number,
    ) {
        super(game, parent, 500, Size.L, 140 + (side > 0 ? 60 : 0))
    }

    protected place() {
        return vec(this.side * 85, 150)
    }

    // 大顎の噛みつき。横へ開いた弾が一度止まり、少しして自機のいた所へ一斉に飛びかかる
    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffd060")
            .p(this.p.clone())
            .speed(4)
            .radian(this.side > 0 ? 0.35 : Math.PI - 0.35)
            .nway(6 + this.generation * 2, 0.22)
            .g(function* (b) {
                yield* Behavior.stop(b, 22)
                yield* Array(10)
                yield* Behavior.aim(b, this.game.player.p, 6)
                yield* Behavior.accel(b, 15, 8 + this.generation)
            })
            .fire(this.game.bullets)

        yield* Array(120 - this.generation * 20)
    }
}

// 一代目の翅(四枚)。胴を囲む正方形の角にあり、外寄りの斜め下へ羽音を流す
class SquareWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
        private readonly row: number,
        private readonly generation: number,
    ) {
        super(game, parent, 300, Size.M, 150 + row * 40 + (side > 0 ? 20 : 0))
    }

    protected place() {
        return vec(this.side * 71, this.row === 0 ? -71 : 71)
    }

    protected *attack() {
        yield* Hornet.buzz(this, T / 4 - this.side * 0.5, this.generation)
    }
}

// 二代目の翅(六枚)。胴を囲んで回る正六角形の角にあり、胴から見て外向きに羽音を流す
class HexWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
        private readonly generation: number,
    ) {
        super(game, parent, 300, Size.M, 150 + i * 20)
    }

    protected place() {
        return vec.arg(this.frame / 200 + (T * this.i) / 6).scale(100)
    }

    protected *attack() {
        yield* Hornet.buzz(this, this.p.sub(this.parent.p).radian(), this.generation)
    }
}

// 脚(六つ)。胴の左右に、横一列に三つずつ並ぶ。order は左からの順番
class Leg extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly x: number,
        private readonly order: number,
        private readonly generation: number,
    ) {
        super(game, parent, 150, Size.S, 170)
    }

    protected place() {
        return vec(Math.sign(this.x) * (60 + 50 * Math.abs(this.x)), 20)
    }

    // 脚の爪。左の脚から順に、だんだん速くなる爪を落とす
    protected *attack() {
        yield* Array(this.order * 6)

        yield* remodel(this)
            .format("line")
            .color("#ffe0a0")
            .p(this.p.clone())
            .speed(3)
            .radian(T / 4)
            .nway(4 + this.generation, 0.16)
            .g((b) => Behavior.ease(b, "speed", 7.5 + this.generation, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(140 - this.order * 6)
    }
}

// 毒針。胴の前の横一列の真ん中
class Stinger extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly generation: number,
    ) {
        super(game, parent, 600, Size.L, 200)
    }

    protected place() {
        return vec(0, 150)
    }

    // 毒針。扇のように線を薄く見せてから、端から順に線に沿って針を撃ち込む。一代目は五本、二代目は七本
    protected *attack() {
        const start = this.p.clone()
        const aim = this.game.player.p.sub(start).radian()

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ff9060")
            .r(2)
            .speed(0)
            .p(start)
            .radian(aim)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .nway(5 + this.generation * 2, 0.26)
            .g(function* (b, k) {
                yield* Behavior.ease(b, "alpha", 0.2, 8)
                yield* Array(22 + k * 10)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(30)

        for (let k = 0; k < 5 + this.generation * 2; k++) {
            yield* remodel(this)
                .format("line")
                .color("#ff9060")
                .p(start)
                .radian(aim + (k - (4 + this.generation * 2) / 2) * 0.26)
                .speed(13 + this.generation)
                .duplicate(6)
                .delayByIndex(2)
                .fire(this.game.bullets)
        }

        yield* Array(130)
    }
}

// 働き蜂。等間隔のまま、胴のまわりの大きな楕円をそろって回る。count は働き蜂の数
class Worker extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
        private readonly count: number,
        private readonly generation: number,
    ) {
        super(game, parent, 180, Size.S, 130)
    }

    protected place() {
        const angle = this.frame / 40 + (T * this.i) / this.count
        return vec(Math.cos(angle) * 180, Math.sin(angle) * 110)
    }

    // 働き蜂の見回り。i 番目の働き蜂は 8i フレーム待ってから、進む向きへ短い弾の列を撃つ
    protected *attack() {
        yield* Array(this.i * 8)

        const before = this.p.clone()
        yield

        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffe890")
            .p(this.p.clone())
            .speed(5)
            .radian(this.p.sub(before).radian())
            .duplicate(4 + this.generation)
            .delayByIndex(4)
            .fire(this.game.bullets)

        yield* Array(70 - this.i * 8)
    }
}

// 親衛隊(六つ)。二代目が翅を落とされると呼ぶ。胴のまわりを逆向きに回る
class Escort extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 300, Size.M, 60 + i * 10)
    }

    protected place() {
        return vec.arg(-this.frame / 90 + (T * this.i) / 6).scale(120)
    }

    // 親衛隊。胴のまわりを回りながら、順に外向きの三方向の弾を撃つ。弾はゆっくり出て一気に速くなる
    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffd060")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.p.sub(this.parent.p).radian())
            .nway(3, 0.25)
            .g((b) => Behavior.ease(b, "speed", 6.5, 35, Ease.In))
            .fire(this.game.bullets)

        yield* Array(90 + (this.i % 2) * 10)
    }
}
