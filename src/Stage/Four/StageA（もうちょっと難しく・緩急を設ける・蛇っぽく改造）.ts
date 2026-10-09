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

export default class extends Stage {
    *G() {
        const boss = new EnemySeiryu(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemySeiryu extends Enemy {
    // 宝珠。頭のまわりの内側の円を回る
    private readonly pearl = new Part(
        this.game,
        this,
        1500,
        Size.L,
        (me) => vec.arg(me.frame / 25).scale(60),
        (me) => this.thunder(me),
        150,
    )

    // 節(十)。頭のまわりの外側の円を、等間隔のままゆっくり回る
    private readonly segments = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(
        (k) =>
            new Part(
                this.game,
                this,
                200,
                Size.S,
                (me) => vec.arg(me.frame / 150 + (T * k) / 10).scale(130),
                (me) => this.scales(me, k),
                170,
            ),
    )

    readonly parts = [this.pearl, ...this.segments]

    constructor(game: Game) {
        super(game, 1600, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
        this.addScript(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move())
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    // 画面の中ほどを大きく動きまわる
    private *move() {
        const path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.3, 3, 2)

        for (let f = 0; ; f++) {
            this.p = path(f / 140).add(this.home())
            yield
        }
    }

    private *phases() {
        // 一段目: 宝珠を落とすと次の段へ
        this.addScript(() => this.ring(), { loop: Infinity, margin: 180, id: "head" })
        while (this.pearl.life > 0) yield

        // 雷雲。雷の力を集めてから、雷玉(孫機)に守られた雷雲を呼ぶ
        this.removeScript("head")
        yield* Charge.gather(this, 150, "#c0f0ff")

        const clouds = [0, 1, 2].map((i) => {
            const cloud = new Part(
                this.game,
                this,
                400,
                Size.M,
                (me) => vec(this.game.WIDTH * (0.2 + 0.3 * i) + 24 * Math.sin(me.frame / 40 + i), 70).sub(this.p),
                (me) => this.rain(me),
                60 + i * 20,
            )
            const orbs = [0, 1].map(
                (k) =>
                    new Part(
                        this.game,
                        cloud,
                        100,
                        Size.S,
                        (me) => vec.arg(me.frame / 25 + k * Math.PI).scale(60),
                        (me) => this.bolt(me),
                        60 + i * 40 + k * 90,
                    ),
            )
            cloud.guardedBy(orbs)
            this.game.enemies.push(cloud, ...orbs)
            return cloud
        })

        // 二段目: 雷雲をすべて落とすと次の段へ。頭は雷跡を残す
        this.addScript(() => this.thunderTrail(), { loop: Infinity, margin: 60, id: "head" })
        while (clouds.some((p) => p.life > 0)) yield

        // 三段目: 昇龍。頭に攻撃が効くようになり、雷跡に咆哮を重ねる
        this.isInvincible = false
        this.game.camera.shake(8, 30)
        this.addScript(() => this.roar(), { loop: Infinity, margin: 30, id: "roar" })
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

    // 節の鱗。輪の順に、頭から見て外向きに鱗を払う
    private *scales(me: Part, k: number) {
        yield* Array(k * 6)

        yield* remodel(me)
            .format("diamond")
            .color("#a0ffd0")
            .p(me.p.clone())
            .speed(1.5)
            .radian(me.p.sub(this.p).radian())
            .nway(3, 0.22)
            .g((b) => Behavior.ease(b, "speed", 6, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(150 - k * 6)
    }

    // 雷雲の雨。雲の下のあちこちから、細い雨粒が真下へ速く落ちる
    private *rain(me: Part) {
        yield* remodel(me)
            .format("line")
            .color("#b0d8ff")
            .p(me.p.clone())
            .speed(7)
            .radian(T / 4)
            .duplicate(8)
            .scatter({ p: 40 })
            .delayByIndex(5)
            .fire(this.game.bullets)

        yield* Array(70)
    }

    // 雷玉の雷。真下へ、細い線で見えてから落ちる
    private *bolt(me: Part) {
        yield* remodel(me)
            .color("#e0f8ff")
            .laser(35, 15, me.p.clone(), me.p.add(vec.arg(T / 4 + (this.random() - 0.5) * 0.3).scale(1500)))
            .fire(this.game.bullets)

        yield* Array(180)
    }

    // 一段目の頭。ときどき輪を吐く
    private *ring() {
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
    }

    // 雷跡。通った跡に雷を残す。残った雷は少しして弾ける
    private *thunderTrail() {
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

    // 昇龍の咆哮。下向きの大きな扇が、ゆっくり出てだんだん速くなる
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

        yield* Array(110)
    }
}
