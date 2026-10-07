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

// ステージ「鉄砲隊」(鉄壁道場・高弟)
// 高弟の前に、六人の鉄砲兵(子機)が横一列に並ぶ。鉄砲兵は端から順に、真下へ速い弾を撃ち下ろす(釣瓶撃ち)。
// 撃ち下ろしは隊列の端から端へ波のように進むので、弾の筋の間に立って、筋が通り過ぎるのを待つ。
// 隊列は左右に動くので、筋の位置も少しずつずれる。鉄砲兵を倒せば、その筋はなくなって通り道が広がる。
// 高弟は、最初はゆっくり、一気に速くなる矢を自機へ撃ってくる。

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.riflemen)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.12, this.game.HEIGHT * 0.03, 1, 2)

    // 鉄砲兵。高弟の前(下)に、72px間隔で横一列に並ぶ
    readonly riflemen = [0, 1, 2, 3, 4, 5].map(
        (i) =>
            new Part(
                this.game,
                this,
                300,
                18,
                (me) => vec((i - 2.5) * 72, 110 + 6 * Math.sin(me.frame / 12 + i)),
                (me) => this.volley(me, i),
                150,
            ),
    )

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 1800, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.arrows(), { loop: Infinity, margin: 90 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 250).add(this.home())
        yield
    }

    // 釣瓶撃ち。i 番目の鉄砲兵は 14i フレーム待ってから、真下へ四発続けて撃つ。
    // 左から右へ撃ち終えたら、今度は右から左へ。一往復(420フレーム)ごとに、少し休む
    private *volley(me: Part, i: number) {
        for (const order of [i, 5 - i]) {
            yield* Array(order * 14)

            yield* remodel(me)
                .format("line")
                .color("#ffe0a0")
                .p(me.p.clone())
                .speed(8)
                .radian(T / 4)
                .duplicate(4, (b, k) => {
                    b.delay = k * 4
                    return b
                })
                .fire(this.game.bullets)

            yield* Array(140 - order * 14)
        }

        yield* Array(140)
    }

    // 最初はゆっくり、一気に速くなる矢
    private *arrows() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffc0a0")
            .p(this.p.clone())
            .speed(1)
            .aim(this.game.player)
            .nway(5, T / 26)
            .g((me) => Behavior.ease(me, "speed", 7, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
