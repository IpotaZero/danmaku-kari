import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"

// ステージ「北斗七星」(三日前・星の河原)
// 師範代(北極星)のまわりを、北斗七星の形に並んだ七つの星(子機)が、形を保ったまま回る。
// 星は柄の先から枡の先へ順に瞬き、それぞれ星形に広がる弾を放つ。星形の弾は尖った所が速く、くぼんだ所が遅い。
// 七つの星形が少しずつずれて重なり、あちこちから広がってくる。星を落とせば、その星形はなくなる。
// 北極星は、一気に速くなる矢を自機へ撃つ。

export default class extends Stage {
    *G() {
        const master = new EnemyPolaris(this.game)
        this.game.enemies.push(master, ...master.stars)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPolaris extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.15, this.game.HEIGHT * 0.03, 1, 2)

    // 北斗七星。柄の先(破軍星)から枡の先(貪狼星)まで。星の並びの重心が北極星から150px離れたところで、形ごと回る
    readonly stars = [
        vec(2.4, 0.05),
        vec(1.85, -0.15),
        vec(1.4, 0),
        vec(0.85, 0.15),
        vec(0.75, 0.65),
        vec(0.1, 0.55),
        vec(0, 0),
    ].map((p, i, all) => {
        const center = all.reduce((sum, q) => sum.add(q), vec(0, 0)).scale(1 / all.length)
        const offset = p.sub(center).scale(85)

        return new Part(
            this.game,
            this,
            260,
            20,
            (me) => {
                const angle = me.frame / 95
                return vec.arg(angle).scale(150).add(offset.rotate(angle))
            },
            (me) => this.twinkle(me, i),
            150,
        )
    })

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 1800, 44, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.arrows(), { loop: Infinity, margin: 80 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.3)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 300).add(this.home())
        yield
    }

    // 星の瞬き。i 番目の星は 10i フレーム待ってから、星形に広がる弾を放つ。一巡(300フレーム)ごとに休む
    private *twinkle(me: Part, i: number) {
        yield* Array(i * 10)

        yield* remodel(me)
            .format("diamond")
            .color(i % 2 === 0 ? "#fff4b0" : "#b8e0ff")
            .p(me.p.clone())
            .radian(this.random() * T)
            .ex(10)
            // 尖った所(偶数番)は速く、くぼんだ所(奇数番)は遅い
            .forEach((b, k) => {
                b.speed = k % 2 === 0 ? 4.5 : 2.6
            })
            .g((b) => Behavior.ease(b, "speed", b.speed * 1.4, 60, Ease.In))
            .fire(this.game.bullets)

        yield* Array(300 - i * 10)
    }

    // 最初はゆっくり、一気に速くなる矢
    private *arrows() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffffff")
            .p(this.p.clone())
            .speed(1)
            .aim(this.game.player)
            .nway(3, T / 24)
            .g((me) => Behavior.ease(me, "speed", 7.5, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }
}
