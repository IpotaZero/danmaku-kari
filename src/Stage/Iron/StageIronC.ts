import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Part } from "../Part"

// ステージ「鉄壁陣」(鉄壁道場・師範代)
// 師範代の前(下)に、五人の盾持ち(子機)が弧を描いて並ぶ。盾持ちは大きく頑丈で、師範代を狙った弾をその身で受け止めてしまう。
// 陣は左右にゆっくり振れるので、盾持ちの隙間から撃ち込むか、盾持ちを倒して陣に穴を開ける。
// 盾持ちは、一度止まってから散る小さな輪を放つ。師範代は盾の上から、一度止まってから一気に速くなる大きな扇を撃つ。

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.guards)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    // 盾持ち。師範代の下に、半径120pxの弧の上に並ぶ。陣はシーソーのように左右へ振れる
    readonly guards = [0, 1, 2, 3, 4].map(
        (i) =>
            new Part(
                this.game,
                this,
                500,
                30,
                (me) => vec.arg(T / 4 + (i - 2) * 0.42 + 0.35 * Math.sin(me.frame / 70)).scale(120),
                (me) => this.bash(me),
                150 + i * 18,
            ),
    )

    constructor(game: Game) {
        // 盾持ちが先に攻撃をすべて受け止めるので、師範代を撃てるのは盾持ちが減ってから。
        // 師範代だけが残るつまらない時間を短くするため、体力は盾持ちの総和よりずっと少なくする
        super(game, 800, 40, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.fan(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 300).add(this.home())
        yield
    }

    // 盾突き。一度止まってから散る小さな輪
    private *bash(me: Part) {
        yield* remodel(me)
            .format("small-ball")
            .r(6)
            .color("#c8d4e8")
            .p(me.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(12)
            .g((b) => Behavior.reaccel(b, 15, 20, 30, 5))
            .fire(this.game.bullets)

        yield* Array(90)
    }

    // 盾の上から、下へ向けて大きな扇。一度止まってから一気に速くなる
    private *fan() {
        yield* remodel(this)
            .format("diamond")
            .color("#9ab8ff")
            .p(this.p.clone())
            .speed(5)
            .radian(T / 4 + (this.random() - 0.5) * 0.3)
            .nway(25, T / 36)
            .g((me) => Behavior.reaccel(me, 25, 15, 40, 6.5))
            .fire(this.game.bullets)

        yield* Array(75)
    }
}
