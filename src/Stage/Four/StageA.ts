import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Charge } from "../Charge"
import { Size } from "../Size"

// 頭のうしろに十二の節が連なる。節は一つ前の節から一定の間をあけるように引っぱられ、縄を引くようになめらかにうねる。
// 光の肋: どの節にも、体を横切る光の線(肋)が一本ずつ通っている。肋は節が速く動くほど長く伸びるので、うねる体そのものが画面を掻く。
// 頭は四つの動きを、休み(2秒)をはさみながら順にくり返す。
//   這う: 画面の上半分を大きくうねる。尾(頭だけになってからは頭)は毒の雫を垂らし続ける。
//   脱皮: 画面を横切ってから立ち止まり、頭に近い節から順に抜け殻を残して離れる。
//         抜け殻は体の形のまま薄く浮かび、少しして実体になり、やがて崩れて降ってくる。
//   締め付け: 自機のいた所を薄い輪で示してから、そのまわりを回りながら輪を縮める。とぐろの隙間から外へ逃げる。
//   潜る: 二本の薄い線で道を示してから、画面を縦に潜って、別の所から浮かび上がる。画面に縦の体が二本並ぶ。
// 最後尾の節(尾)にしか攻撃が効かない(ほかの節は弾が素通りする)。尾を落とすと、一つ前の節が新しい尾になる。体は短くなるほど速く動く。
// 節をすべて落とすと、頭は力を溜めてから攻撃が効くようになる。頭は動いた跡に肋の残像を残し、残像が失った体の代わりになる。

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.segments)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    // 節(十二)。頭に近い順に並ぶ
    readonly segments: Segment[] = []

    constructor(game: Game) {
        super(game, 1200, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = vec(this.game.WIDTH / 2, -200)

        for (let k = 0; k < 12; k++) {
            this.segments.push(new Segment(game, this.segments[k - 1] ?? this))
        }

        this.addScript(() => this.enter())
        this.addScript(() => this.phases())
    }

    private *enter() {
        yield* this.glide(this.home(), 150)
        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.22)
    }

    // 落とされた節が多いほど速く動く。動きにかけるフレーム数をこれで割る
    private haste() {
        return 1 + 0.05 * this.segments.filter((p) => p.life <= 0).length
    }

    // いまの尾(生きている節のうち、いちばんうしろ)
    private tail() {
        const alive = this.segments.filter((p) => p.life > 0)
        return alive[alive.length - 1]
    }

    // 四つの動きを、休みをはさみながら順にくり返す
    private *move() {
        yield* this.slither()
        yield* this.glide(this.home(), 120)
        yield* this.shed()
        yield* this.glide(this.home(), 120)
        yield* this.constrict()
        yield* this.glide(this.home(), 120)
        yield* this.dive()
        yield* this.glide(this.home(), 120)
    }

    // frames フレームかけて、なめらかに end へ動く
    private *glide(end: Vec, frames: number) {
        const start = this.p.clone()

        for (let f = 1; f <= frames; f++) {
            this.p = start.add(end.sub(start).scale(Ease.InOut(f / frames)))
            yield
        }
    }

    // 這う。画面の上半分を大きくうねる。尾(頭だけになってからは頭)は毒の雫を垂らし続ける
    private *slither() {
        const path = Curves.lissajous(this.game.WIDTH * 0.7, this.game.HEIGHT * 0.3, 3, 2)
        const frames = Math.floor(600 / this.haste())

        for (let f = 0; f < frames; f++) {
            this.p = path((f / frames) * T).add(this.home())

            const tail = this.tail() ?? this
            if (f % 8 === 0) {
                yield* remodel(tail)
                    .format("small-ball")
                    .r(6)
                    .color("#e0ffc0")
                    .p(tail.p.clone())
                    .speed(0.5)
                    .radian(T / 4)
                    .g((b) => Behavior.ease(b, "speed", 5, 60, Ease.In))
                    .fire(this.game.bullets)
            }

            yield
        }
    }

    // 脱皮。画面を波打ちながら横切ってから立ち止まり、頭に近い節から順に抜け殻を残す
    private *shed() {
        const side = this.p.x < this.game.WIDTH / 2 ? 1 : -1
        const startX = this.game.WIDTH / 2 - side * this.game.WIDTH * 0.38
        yield* this.glide(vec(startX, this.game.HEIGHT * 0.3), 80)

        const frames = Math.floor(240 / this.haste())
        for (let f = 0; f < frames; f++) {
            this.p = vec(
                startX + side * this.game.WIDTH * 0.76 * Ease.InOut(f / frames),
                this.game.HEIGHT * 0.3 + 110 * Math.sin((f / frames) * T * 1.5),
            )
            yield
        }

        yield* Array(20)
        this.segments.filter((p) => p.life > 0).forEach((p, k) => p.addScript(() => p.shed(), { margin: k * 4 }))
        yield* Array(60)
    }

    // 締め付け。自機のいた所を薄い輪で示してから、そのまわりを回りながら輪を縮める
    private *constrict() {
        const center = vec(
            Math.min(Math.max(this.game.player.p.x, 130), this.game.WIDTH - 130),
            Math.min(Math.max(this.game.player.p.y, this.game.HEIGHT * 0.3), this.game.HEIGHT * 0.75),
        )
        const start = this.p.sub(center).radian()

        // 予告の輪。これから締め付ける大きさ
        yield* remodel(this)
            .format("small-ball")
            .r(4)
            .type("neutral")
            .isScorable(false)
            .color("#d0ffa0")
            .speed(0)
            .duplicate(48, (b, i) => {
                b.p = center.add(vec.arg((T * i) / 48).scale(260))
                return b
            })
            .alpha(0)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.35, 20)
                yield* Array(60)
                yield* Behavior.fadeout(b, 20)
            })
            .fire(this.game.bullets)

        yield* this.glide(center.add(vec.arg(start).scale(260)), 80)

        const frames = Math.floor(360 / this.haste())
        for (let f = 0; f < frames; f++) {
            this.p = center.add(vec.arg(start + f * 0.03).scale(260 - 170 * Ease.InOut(f / frames)))
            yield
        }
    }

    // 潜る。二本の薄い線で道を示してから、画面を縦に潜り、画面の下の外で折り返して、別の所から浮かび上がる
    private *dive() {
        const down = this.game.WIDTH * (0.2 + 0.25 * this.random())
        const up = this.game.WIDTH - down

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#d0ffa0")
            .r(2)
            .speed(0)
            .radian(T / 4)
            .length(this.game.HEIGHT)
            .alpha(0)
            .duplicate(2, (b, i) => {
                b.p = vec(i === 0 ? down : up, 0)
                return b
            })
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.2, 15)
                yield* Array(90)
                yield* Behavior.fadeout(b, 15)
            })
            .fire(this.game.bullets)

        yield* this.glide(vec(down, -150), 90)
        yield* this.glide(vec(down, this.game.HEIGHT + 250), Math.floor(110 / this.haste()))
        yield* this.glide(vec(up, this.game.HEIGHT + 250), 40)
        yield* this.glide(vec(up, -150), Math.floor(110 / this.haste()))
    }

    private *phases() {
        // 最後尾の節(尾)にしか攻撃が効かない。尾を落とすと、一つ前の節が新しい尾になる
        while (this.segments.some((p) => p.life > 0)) {
            const tail = this.tail()
            this.segments.forEach((p) => (p.isInvincible = p !== tail))
            yield
        }

        // 頭だけになると、力を溜めてから攻撃が効くようになる。動いた跡に肋の残像を残す
        yield* Charge.gather(this, 120, "#d0ffa0")
        this.isInvincible = false
        this.addScript(() => this.afterimage(), { loop: Infinity, id: "afterimage" })
    }

    // 残像。動いた跡に、進む向きを横切る肋の形の光を残す。光はしばらくその場にとどまって消える。速く動くほど長い
    private *afterimage() {
        const before = this.p.clone()
        yield

        const velocity = this.p.sub(before)
        if (velocity.magnitude() < 1) return

        const across = velocity.radian() + T / 4
        const half = 40 + Math.min(velocity.magnitude() * 14, 90)

        yield* remodel(this)
            .appearance("beam")
            .collision("rect")
            .isScorable(false)
            .color("#d0ffa0")
            .r(4)
            .speed(0)
            .radian(across)
            .length(half * 2)
            .p(this.p.sub(vec.arg(across).scale(half)))
            .appear(10)
            .g(function* (b) {
                yield* Array(90)
                yield* Behavior.fadeout(b, 20)
            })
            .fire(this.game.bullets)

        yield* Array(3)
    }
}

// 節。一つ前の節(先頭の節は頭)から40pxの間をあけるように引っぱられてついていく。
// 体を横切る光の肋を一本持ち、肋は速く動くほど長く伸びる
class Segment extends Enemy {
    constructor(game: Game, leader: Enemy) {
        super(game, 150, Size.M)
        this.p = leader.p.clone()

        this.addScript(() => this.follow(leader), { loop: Infinity })
        this.addScript(() => this.rib(leader))
    }

    // 一つ前の節から40pxより離れたら、その分だけ引き寄せられる
    private *follow(leader: Enemy) {
        const diff = this.p.sub(leader.p)
        const distance = diff.magnitude()
        if (distance > 40) this.p = leader.p.add(diff.scale(40 / distance))
        yield
    }

    // 光の肋。この節を体の向きと直角に横切る光の線。速く動くほど長く伸び、ゆっくりだと節の中に縮む。節が倒れると消える
    private *rib(leader: Enemy) {
        const me = this

        yield* remodel(this)
            .appearance("beam")
            .collision("rect")
            .isScorable(false)
            .color("#d0ffa0")
            .r(4)
            .speed(0)
            .length(this.r * 2)
            // 節と一緒に画面の外へ出ても消えない
            .unbounded()
            .g(function* (b) {
                let before = me.p.clone()
                let half = me.r

                while (me.life > 0) {
                    const speed = me.p.sub(before).magnitude()
                    before = me.p.clone()

                    half += (me.r + Math.min(speed * 14, 70) - half) * 0.15
                    b.radian = leader.p.sub(me.p).radian() + T / 4
                    b.length = half * 2
                    b.p = me.p.sub(vec.arg(b.radian).scale(half))
                    yield
                }

                yield* Behavior.fadeout(b, 15)
            })
            .fire(this.game.bullets)
    }

    // 脱皮。この節の形の抜け殻を残す。抜け殻は薄く浮かび、少しして実体になり、やがてばらばらに崩れて降ってくる
    *shed() {
        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#f0ffe0")
            .speed(0)
            .duplicate(10, (b, i) => {
                b.p = this.p.add(vec.arg((T * i) / 10).scale(this.r + 4))
                return b
            })
            .appear(40)
            .g(function* (b) {
                yield* Array(100)
                b.radian = T / 4 + (this.random() - 0.5) * 0.6
                yield* Behavior.accel(b, 60, 2 + this.random() * 1.5)
            })
            .fire(this.game.bullets)
    }
}
