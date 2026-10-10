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

// 頭のうしろに十二の節が連なり、頭の通った道をそのままたどってうねる。
// 動きは一巡(420フレーム)ごとに、ゆっくり這う(220) → 素早く突進する(50) → ほとんど止まって休む(150) をくり返す。
// 節: 這っている間に二度、頭に近い節から順に、体の両脇へ脚の弾を払う。体がうねっているので、弾はあちこちへ向かう。
// 頭: 突進している間、通った跡に毒を残す。毒は突進が終わると、そろって小さく弾ける。
// 最後尾の節(尾)にしか攻撃が効かない(ほかの節は弾が素通りする)。尾を落とすと、一つ前の節が新しい尾になる。
// 体は短くなるほど速くうねり、脚の弾も多く速くなる。
// 節をすべて落とすと、頭は力を溜めてから攻撃が効くようになり、這いはじめに大きな扇も吐くようになる。

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
    // 頭が通った道。頭が6px動くごとに一点ずつ、新しいものほど前に記録する。這う速さによらず、節の間隔が一定になる
    private readonly trail: Vec[] = []

    // 節(十二)。頭の通った道を、42pxずつ間をあけてたどる
    private readonly segments: Part[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(
        (k) =>
            new Part(
                this.game,
                this,
                150,
                Size.M,
                () => (this.trail[(k + 1) * 7] ?? this.trail[this.trail.length - 1] ?? this.p).sub(this.p),
                (me) => this.legs(me),
                140 + k * 5,
            ),
    )

    readonly parts = this.segments

    constructor(game: Game) {
        super(game, 1200, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move())
        this.addScript(() => this.venom(), { loop: Infinity, margin: 220, id: "venom" })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.32)
    }

    // 這う → 突進する → 休む をくり返す。落とされた節が多いほど速い
    private *move() {
        const path = Curves.lissajous(this.game.WIDTH * 0.7, this.game.HEIGHT * 0.35, 3, 2)

        for (let t = 0; ;) {
            const haste = 1 + 0.08 * this.segments.filter((p) => p.life <= 0).length

            for (let f = 0; f < 220; f++) {
                t += haste / 300
                this.crawl(path(t).add(this.home()))
                yield
            }

            for (let f = 0; f < 50; f++) {
                t += haste / 60
                this.crawl(path(t).add(this.home()))
                yield
            }

            for (let f = 0; f < 150; f++) {
                t += haste / 900
                this.crawl(path(t).add(this.home()))
                yield
            }
        }
    }

    // 頭を p へ動かし、通った道を覚える
    private crawl(p: Vec) {
        this.p = p

        if (this.trail.length === 0 || this.trail[0].sub(p).magnitude() >= 6) {
            this.trail.unshift(p.clone())
            this.trail.length = Math.min(this.trail.length, 120)
        }
    }

    private *phases() {
        // 最後尾の節(尾)にしか攻撃が効かない。尾を落とすと、一つ前の節が新しい尾になる
        while (this.segments.some((p) => p.life > 0)) {
            const alive = this.segments.filter((p) => p.life > 0)
            this.segments.forEach((p) => (p.isInvincible = p !== alive[alive.length - 1]))
            yield
        }

        // 頭だけになると、力を溜めてから攻撃が効くようになり、這いはじめに大きな扇も吐く
        yield* Charge.gather(this, 120, "#d0ffa0")
        this.isInvincible = false
        this.addScript(() => this.roar(), {
            loop: Infinity,
            margin: (420 - ((this.frame - 120) % 420)) % 420,
            id: "roar",
        })
    }

    // 節の脚。這っている間に二度、体の両脇へ三筋ずつ払う。落とされた節が多いほど、筋が増えて速くなる
    private *legs(me: Part) {
        for (let k = 0; k < 2; k++) {
            const before = me.p.clone()
            yield

            const lost = this.segments.filter((p) => p.life <= 0).length

            yield* remodel(me)
                .format("diamond")
                .color("#d0ffa0")
                .p(me.p.clone())
                .speed(1.5)
                .radian(me.p.sub(before).radian())
                .nway(2, T / 2)
                .nway(3 + Math.floor(lost / 4), 0.22)
                .g((b) => Behavior.ease(b, "speed", 6 + lost * 0.2, 40, Ease.In))
                .fire(this.game.bullets)

            yield* Array(109)
        }

        // 突進と休みの間は撃たない
        yield* Array(200)
    }

    // 頭の毒。突進している間、通った跡に毒を残す。毒は突進が終わると、そろって三つに弾ける
    private *venom() {
        for (let f = 0; f < 50; f += 3) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#e0ffc0")
                .p(this.p.clone())
                .speed(0)
                .radian(this.random() * T)
                .appear(8)
                .g(function* (b) {
                    yield* Array(70 - f)

                    yield* remodel(this)
                        .format("small-ball")
                        .r(5)
                        .color("#d0ffa0")
                        .p(b.p.clone())
                        .speed(2)
                        .radian(this.random() * T)
                        .ex(3)
                        .g((c) => Behavior.ease(c, "speed", 5, 30, Ease.In))
                        .fire(this.game.bullets)

                    b.life = 0
                })
                .fire(this.game.bullets)
            yield* Array(3)
        }

        yield* Array(420 - 51)
    }

    // 頭だけになってからの扇。這いはじめに、下向きの大きな扇がゆっくり出てだんだん速くなる
    private *roar() {
        yield* remodel(this)
            .format("line")
            .color("#a0ffd0")
            .p(this.p.clone())
            .speed(1.5)
            .radian(T / 4)
            .nway(15, 0.17)
            .g((b) => Behavior.ease(b, "speed", 7.5, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(420)
    }
}
