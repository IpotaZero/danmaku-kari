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
import { Size } from "../Size"

// ステージ「カブト」(鉄壁道場・道場主)
// 道場主のまわりに子機が幾何学的に並ぶ。胴の前に角と左右一対の鞘翅、胴のまわりに正六角形の輪(脚)。
// 角: 自機へ向けて予告の線を引き、少しして線に沿って速い針の列を突き出す。
// 鞘翅: 胴の前の大きな一対。胴を狙った弾をその身で受け止める。ゆっくりした大玉の輪を放つ。
// 脚: 正六角形に並んでゆっくり回り、順に外向きの扇を撃つ。扇の波が輪をひと回りする。
// 鞘翅を両方割ると、胴の前に後翅の一対が現れて飛び立つ。後翅は速い扇を払い、胴に攻撃が効くようになって、胴は渦を撃ちはじめる。

export default class extends Stage {
    *G() {
        const boss = new EnemyKabuto(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        // 鞘翅が残っている間は、胴に攻撃が効かない
        while (boss.life > 0) {
            boss.isInvincible = boss.frame < 120 || boss.elytra.some((p) => p.life > 0)
            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyKabuto extends Enemy {
    private readonly horn = new Horn(this.game, this)
    readonly elytra = [-1, 1].map((side) => new Elytron(this.game, this, side))
    private readonly legs = [0, 1, 2, 3, 4, 5].map((i) => new Leg(this.game, this, i))

    readonly parts = [this.horn, ...this.elytra, ...this.legs]

    constructor(game: Game) {
        super(game, 2800, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.takeOff(), { margin: 120 })
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.walk(), { id: "move" })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    // 地上では、左右にのしのしと歩く
    private *walk() {
        const path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 2, 3)
        for (let f = 0; ; f++) {
            this.p = path(f / 260).add(this.home())
            yield
        }
    }

    // 飛び立った後は、大きく速く飛びまわる
    private *fly() {
        const path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.22, 2, 3)
        for (let f = 0; ; f++) {
            this.p = path(f / 150)
                .add(this.home())
                .add(vec(0, this.game.HEIGHT * 0.06))
            yield
        }
    }

    // 鞘翅が両方割れたら、後翅を広げて飛び立つ
    private *takeOff() {
        while (this.elytra.some((p) => p.life > 0)) yield

        this.game.camera.shake(8, 30)

        // 一度もとの位置へ戻ってから飛びまわる
        this.scripts.remove("move")
        yield* this.moveTo(this.home().add(vec(0, this.game.HEIGHT * 0.06)), 40)
        this.scripts.add(() => this.fly(), { id: "move" })

        // 後翅は胴の前の左右一対(胴の後ろだと、胴にさえぎられて撃てない)
        const wings = [-1, 1].map((side) => new HindWing(this.game, this, side))
        this.game.enemies.push(...wings)

        this.scripts.add(() => this.whirl(), { loop: Infinity, margin: 60 })
    }

    // 飛び立った胴の渦。四本の腕がまわる
    private *whirl() {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -1 : 1

        for (let f = 0; f < 90; f += 5) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#ffffff")
                .p(this.p.clone())
                .speed(5)
                .radian(base + turn * f * 0.05)
                .ex(4)
                .ex(3)
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(80)
    }
}

// 角。胴の真下にある
class Horn extends Part {
    constructor(game: Game, parent: Enemy) {
        super(game, parent, 700, Size.L, 160)
    }

    protected place() {
        return vec(0, 100)
    }

    // 角突き。自機へ向けて予告の線を引き、少しして線に沿って針の列を突き出す
    protected *attack() {
        const start = this.p.clone()
        const radian = this.game.player.p.sub(start).radian()

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#ffe0a0")
            .r(2)
            .speed(0)
            .p(start)
            .radian(radian)
            .length(this.game.WIDTH + this.game.HEIGHT)
            .alpha(0)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.1, 10)
                yield* Array(25)
                yield* Behavior.fadeout(b, 8)
            })
            .fire(this.game.bullets)

        yield* Array(35)

        yield* remodel(this)
            .format("line")
            .color("#ffe0a0")
            .p(start)
            .radian(radian)
            .speed(11)
            .duplicate(10)
            .delayByIndex(2)
            .fire(this.game.bullets)

        yield* Array(90)
    }
}

// 鞘翅(左右一対)。胴の前にある
class Elytron extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 700, Size.L, 200 + (side > 0 ? 75 : 0))
    }

    protected place() {
        return vec(this.side * 54, 38)
    }

    // 鞘翅の大玉。ゆっくり出て、少しずつ速くなる
    protected *attack() {
        yield* remodel(this)
            .format("big-ball")
            .color("#c8d4e8")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.random() * T)
            .ex(10)
            .g((b) => Behavior.accel(b, 60, 4))
            .fire(this.game.bullets)

        yield* Array(150)
    }
}

// 脚(六つ)。胴のまわりに正六角形に並び、形を保ったままゆっくり回る
class Leg extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly i: number,
    ) {
        super(game, parent, 220, Size.S, 150)
    }

    protected place() {
        return vec.arg(this.frame / 240 + (T * this.i) / 6).scale(165)
    }

    // 脚の扇。輪の順に外向きの扇を撃つので、波が輪をひと回りする。一巡(220フレーム)ごとに休む
    protected *attack() {
        yield* Array(this.i * 15)

        yield* remodel(this)
            .format("diamond")
            .color("#9ab8ff")
            .p(this.p.clone())
            .speed(2)
            .radian(this.p.sub(this.parent.p).radian())
            .nway(3, T / 20)
            .g((b) => Behavior.ease(b, "speed", 6.5, 35, Ease.In))
            .fire(this.game.bullets)

        yield* Array(220 - this.i * 15)
    }
}

// 後翅(左右一対)。飛び立つときに広げる。胴の前にある(胴の後ろだと、胴にさえぎられて撃てない)
class HindWing extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 450, Size.M, 70 + (side > 0 ? 30 : 0))
    }

    protected place() {
        return vec(this.side * 80, 112)
    }

    // 後翅の扇。外寄りの下へ、速い扇を払う
    protected *attack() {
        yield* remodel(this)
            .format("diamond")
            .color("#d8e8ff")
            .p(this.p.clone())
            .speed(6)
            .radian(T / 4 + this.side * 0.7)
            .nway(9, T / 28)
            .fire(this.game.bullets)

        yield* Array(60)
    }
}
