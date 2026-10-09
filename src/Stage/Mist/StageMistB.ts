import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"
import { Size } from "../Size"

// ステージ「霧吹き」(霧隠道場・高弟)
// 画面の左右の端に、四つの霧吹き(子機)が据えられている。霧吹きは首を振りながら、速い霧の筋を撒き散らす。
// 筋は弾が詰まっていて抜けられないので、首振りに合わせて筋の来ない所へ回り込む。
// 上の二つと下の二つは時間をずらして撒くので、上下から交互に筋が薙いでくる。
// 高弟は、止まってから散る輪を放つ。霧吹きを壊せば、その筋はなくなる。

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.sprayers)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 2, 3)

    // 霧吹き。左上・右上・左下・右下
    readonly sprayers = [
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
    ].map(
        ([side, row]) =>
            new Part(
                this.game,
                this,
                450,
                Size.S,
                // 画面の端の決まった高さで、少し上下に揺れる
                (me) =>
                    vec(this.game.WIDTH / 2 + side * this.game.WIDTH * 0.44, this.game.HEIGHT * (0.26 + 0.22 * row))
                        .add(vec(0, 20 * Math.sin(me.frame / 40)))
                        .sub(this.p),
                (me) => this.spray(me, side, row),
                150 + row * 120,
            ),
    )

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 1800, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.ring(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 400).add(this.home())
        yield
    }

    // 霧吹きの首振り。画面の内側を向いて、上下に120フレームで一往復しながら、150フレーム撒き続け、210フレーム休む
    private *spray(me: Part, side: number, row: number) {
        const inward = side < 0 ? 0 : T / 2
        const tilt = row === 0 ? 0.55 : -0.1

        for (let f = 0; f < 150; f += 4) {
            const swing = Math.sin((T * f) / 120) * 0.75

            yield* remodel(me)
                .format("diamond")
                .color("#d8e0ff")
                .p(me.p.clone())
                .speed(6)
                .radian(inward - side * (tilt + swing))
                .fire(this.game.bullets)

            yield* Array(4)
        }

        yield* Array(210)
    }

    // 止まってから散る輪
    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffb0d0")
            .p(this.p.clone())
            .speed(5)
            .radian(this.random() * T)
            .ex(36)
            .g((me) => Behavior.reaccel(me, 25, 25, 30, 5))
            .fire(this.game.bullets)

        yield* Array(110)
    }
}
