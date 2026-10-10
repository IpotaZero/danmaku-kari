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
// 頭は五つの動きを、休み(2秒)をはさみながら順にくり返す。動きによっては画面の外まで飛び出す。
//   這う: ゆっくりうねってから、反対側へ素早く突進する。突進の間、通った跡に毒を残し、毒は突進が終わるとそろって弾ける。
//   薙ぐ: 画面の外の左上から、画面の外の右へ、体ごと画面を斜めに薙ぐ。
//   八の字: 画面いっぱいに大きな八の字を描く。
//   噛む: 自機の方へ三度にじり寄り、そのたびに左右から顎(ビーム)を閉じて挟み込む。
//   とぐろ: 渦を描いて巻き込み、またほどける。
// 節: 速く動いている間は、通った所に大きな毒だまりを残す(現れて、少し残って、消える)。ゆっくりの間は、体の両脇へ脚の弾を払う。
// 最後尾の節(尾)にしか攻撃が効かない(ほかの節は弾が素通りする)。尾を落とすと、一つ前の節が新しい尾になる。
// 体は短くなるほど速く動き、脚の弾も多く速くなる。
// 節をすべて落とすと、頭は力を溜めてから攻撃が効くようになる。節の毒を頭が受け継ぎ、ときどき大きな扇も吐くようになる。

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
    // 頭が通った道。頭が6px動くごとに一点ずつ、新しいものほど前に記録する。動く速さによらず、節の間隔が一定になる
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
                (me) => this.poison(me),
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
        yield* this.glide(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.25)
    }

    // 落とされた節が多いほど速く動く。動きにかけるフレーム数をこれで割る
    private haste() {
        return 1 + 0.06 * this.segments.filter((p) => p.life <= 0).length
    }

    // 五つの動きを、休みをはさみながら順にくり返す
    private *move() {
        yield* this.creep()
        yield* this.glide(this.home(), 120)
        yield* this.sweep()
        yield* this.glide(this.home(), 120)
        yield* this.eight()
        yield* this.glide(this.home(), 120)
        yield* this.bite()
        yield* this.glide(this.home(), 120)
        yield* this.coil()
        yield* this.glide(this.home(), 120)
    }

    // 頭を p へ動かし、通った道を覚える
    private crawl(p: Vec) {
        this.p = p

        if (this.trail.length === 0 || this.trail[0].sub(p).magnitude() >= 6) {
            this.trail.unshift(p.clone())
            this.trail.length = Math.min(this.trail.length, 120)
        }
    }

    // frames フレームかけて、なめらかに end へ動く
    private *glide(end: Vec, frames: number) {
        const start = this.p.clone()

        for (let f = 1; f <= frames; f++) {
            this.crawl(start.add(end.sub(start).scale(Ease.InOut(f / frames))))
            yield
        }
    }

    // 這う。ゆっくりうねってから、反対側へ素早く突進する。突進の間、通った跡に毒を残す。毒は突進が終わるとそろって弾ける
    private *creep() {
        const path = Curves.lissajous(this.game.WIDTH * 0.6, this.game.HEIGHT * 0.2, 3, 2)
        const center = this.p.clone()
        const frames = Math.floor(200 / this.haste())

        for (let f = 0; f < frames; f++) {
            this.crawl(path((f / frames) * T).add(center))
            yield
        }

        const start = this.p.clone()
        const end = vec(this.game.WIDTH - start.x, this.game.HEIGHT * (0.35 + 0.15 * this.random()))

        for (let f = 0; f < 40; f++) {
            this.crawl(start.add(end.sub(start).scale(Ease.InOut(f / 40))))

            if (f % 3 === 0) {
                yield* remodel(this)
                    .format("small-ball")
                    .r(6)
                    .color("#e0ffc0")
                    .p(this.p.clone())
                    .speed(0)
                    .appear(8)
                    .g(function* (b) {
                        yield* Array(60 - f)

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
            }

            yield
        }
    }

    // 薙ぐ。画面の外の左上から、画面の外の右へ、体ごと画面を斜めに薙ぐ
    private *sweep() {
        const side = this.random() < 0.5 ? -1 : 1

        yield* this.glide(
            vec(this.game.WIDTH / 2 - side * (this.game.WIDTH / 2 + 180), this.game.HEIGHT * 0.12),
            Math.floor(70 / this.haste()),
        )
        yield* this.glide(
            vec(this.game.WIDTH / 2 + side * (this.game.WIDTH / 2 + 180), this.game.HEIGHT * 0.5),
            Math.floor(110 / this.haste()),
        )
    }

    // 八の字。画面いっぱいに大きな八の字を描く
    private *eight() {
        const center = vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.35)
        yield* this.glide(center, 50)

        const frames = Math.floor(320 / this.haste())
        for (let f = 0; f < frames; f++) {
            const t = (f / frames) * T
            this.crawl(center.add(vec(Math.sin(t) * this.game.WIDTH * 0.45, Math.sin(2 * t) * this.game.HEIGHT * 0.25)))
            yield
        }
    }

    // 噛む。自機の方へ三度にじり寄り、そのたびに左右から顎(ビーム)を閉じて挟み込む
    private *bite() {
        for (let k = 0; k < 3; k++) {
            const toward = this.p.add(this.game.player.p.sub(this.p).scale(0.6))
            yield* this.glide(vec(toward.x, Math.min(toward.y, this.game.HEIGHT * 0.55)), 35)

            const aim = this.game.player.p.sub(this.p).radian()

            yield* remodel(this)
                .beam(0)
                .color("#e0ffc0")
                .radian(aim)
                .nway(2, T / 5)
                .g(function* (b) {
                    yield* Behavior.ease(b, "length", 420, 18, Ease.Out)
                    yield* Behavior.ease(b, "radian", aim, 8, Ease.In)
                    yield* Behavior.fadeout(b, 15)
                })
                .fire(this.game.bullets)

            yield* Array(40)
        }
    }

    // とぐろ。渦を描いて巻き込み、またほどける
    private *coil() {
        const center = vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
        yield* this.glide(center.add(vec(230, 0)), 50)

        const frames = Math.floor(300 / this.haste())
        for (let f = 0; f < frames; f++) {
            const radius = 60 + 170 * Math.abs(Math.cos((f / frames) * Math.PI))
            this.crawl(center.add(vec(Math.cos(f * 0.05) * radius, Math.sin(f * 0.05) * radius * 0.7)))
            yield
        }
    }

    private *phases() {
        // 最後尾の節(尾)にしか攻撃が効かない。尾を落とすと、一つ前の節が新しい尾になる
        while (this.segments.some((p) => p.life > 0)) {
            const alive = this.segments.filter((p) => p.life > 0)
            this.segments.forEach((p) => (p.isInvincible = p !== alive[alive.length - 1]))
            yield
        }

        // 頭だけになると、力を溜めてから攻撃が効くようになる。節の毒を頭が受け継ぎ、ときどき大きな扇も吐く
        yield* Charge.gather(this, 120, "#d0ffa0")
        this.isInvincible = false
        this.addScript(() => this.poison(this), { loop: Infinity, id: "poison" })
        this.addScript(() => this.roar(), { loop: Infinity, id: "roar" })
    }

    // 節(頭だけになってからは頭)の毒。速く動いている間は、通った所に大きな毒だまりを残す(現れて、少し残って、消える)。
    // ゆっくりの間は、体の両脇へ三筋ずつ脚の弾を払う。落とされた節が多いほど、筋が増えて速くなる
    private *poison(me: Enemy) {
        const before = me.p.clone()
        yield

        if (me.p.sub(before).magnitude() > 3) {
            yield* remodel(me)
                .format("big-ball")
                .r(28)
                .color("#d0ffa0")
                .p(me.p.clone())
                .speed(0)
                .appear(15)
                .g(function* (b) {
                    yield* Array(30)
                    yield* Behavior.fadeout(b, 15)
                })
                .fire(this.game.bullets)

            yield* Array(25)
            return
        }

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

        yield* Array(110)
    }

    // 頭だけになってからの扇。下向きの大きな扇がゆっくり出て、だんだん速くなる
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

        yield* Array(150)
    }
}
