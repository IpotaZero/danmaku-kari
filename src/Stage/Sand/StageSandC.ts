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

// ステージ「蟻の行進」(五日前・砂の崖)
// 画面の中ほどの高さに横長の楕円の道があり、六匹の蟻(子機)が等間隔の一列になって、その道をぐるぐる行進する。
// 蟻は行進しながら、自機へ扇形に砂を投げてくる。
// 蟻は砂袋を背負っていて、倒すとその場で砂が輪になって飛び散る。倒す場所とタイミングも考える。
// 師範代は上から、止まってから散る砂の扇を浴びせてくる。

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.ants)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.05, 2, 3)

    // 蟻。横長の楕円の道を、等間隔の一列になって同じ速さで行進する
    readonly ants = [0, 1, 2, 3, 4, 5].map(
        (i) =>
            new Part(
                this.game,
                this,
                300,
                18,
                (me) =>
                    vec(
                        this.game.WIDTH / 2 + this.game.WIDTH * 0.4 * Math.cos(me.frame / 110 + (T * i) / 6),
                        this.game.HEIGHT * 0.45 + this.game.HEIGHT * 0.07 * Math.sin(me.frame / 110 + (T * i) / 6),
                    ).sub(this.p),
                (me) => this.throwSand(me),
                140 + i * 13,
            ),
    )

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
        this.addScript(() => this.watchAnts(), { margin: 120 })
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.shower(), { loop: Infinity, margin: 40 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 250).add(this.home())
        yield
    }

    // 蟻が自機へ投げる砂。ゆっくり出て、一気に速くなる
    private *throwSand(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(6)
            .color("#ffd890")
            .p(me.p.clone())
            .speed(1.2)
            .aim(this.game.player)
            .nway(3, T / 16)
            .g((b) => Behavior.ease(b, "speed", 6, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(85)
    }

    // 倒れた蟻の砂袋が破れて、砂が輪になって飛び散る
    private *watchAnts() {
        const alive = new Set(this.ants)

        while (this.life > 0) {
            for (const ant of alive) {
                if (ant.life > 0) continue
                alive.delete(ant)

                yield* remodel(this)
                    .format("small-ball")
                    .r(5)
                    .color("#ffe8b8")
                    .p(ant.p.clone())
                    .speed(2.2)
                    .radian(this.random() * T)
                    .ex(14)
                    .fire(this.game.bullets)
            }

            yield
        }
    }

    // 下へ向けて広く砂の扇を浴びせる。扇は一度止まってから散る
    private *shower() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffc870")
            .p(this.p.clone())
            .speed(4)
            .radian(T / 4 + (this.random() - 0.5) * 0.2)
            .nway(21, T / 32)
            .g((me) => Behavior.reaccel(me, 20, 20, 40, 5.5))
            .fire(this.game.bullets)

        yield* Array(130)
    }
}
