import { vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Meteor } from "./Meteor"
import { Size } from "../Size"

// ステージ「流れ星」(流星道場・門下生)
// 画面を斜めに横切る平行な予告線が、少しずつ時間をずらして何本も引かれ、引かれた線に沿って流れ星が駆け抜ける。
// 流れ星の後には尾が残り、しばらく斜めの縞になって画面に留まる。縞は抜けられないので、予告線と予告線の間に立っておく。
// 門下生のまわりを四つの星屑(子機)が回っていて、二つは自機へ扇を、二つは輪を撃ってくる。
// 星屑を落とせば、その攻撃はなくなる。縞の間を移りながら、星屑の弾もかわす。

export default class extends Stage {
    *G() {
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, ...[0, 1, 2, 3].map((i) => new EnemyStardust(this.game, pupil, i)))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.08, 2, 3)

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 2000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 400).add(this.home())
        yield
    }

    // 流星群を二回。二回目は斜めの向きが変わる。そのあと2秒半ほど休む
    private *cycle() {
        yield* GenUtils.all({
            first: this.shower(0),
            second: this.shower(110),
            wait: Array(440),
        })
    }

    // 斜めの向きを決め、平行な線(間隔70px)の6割ほどに予告線を引いて、流れ星を流す
    private *shower(wait: number) {
        yield* Array(wait)

        const angle = T / 4 + (this.random() < 0.5 ? -1 : 1) * (T / 14 + (this.random() * T) / 14)
        const center = vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
        const normal = vec.arg(angle + T / 4)
        const reach = (this.game.WIDTH + this.game.HEIGHT) / 2
        const offset = this.random() * 70

        const lanes = Array.from({ length: Math.ceil((reach * 2) / 70) }, (_, k) =>
            center.add(normal.scale(-reach + offset + k * 70)),
        ).filter(() => this.random() < 0.6)

        yield* GenUtils.all(
            Object.fromEntries(
                lanes.map((through, k) => [
                    `lane${k}`,
                    (function* (me: EnemyPupil) {
                        yield* Array(Math.floor(me.random() * lanes.length) * 6)
                        yield* Meteor.fall(me, through, angle, {
                            preview: 50,
                            speed: 8,
                            tailInterval: 2,
                            tailLife: 40,
                            color: "#fff4b0",
                        })
                    })(this),
                ]),
            ),
        )
    }
}

// 門下生のまわりを回る星屑。偶数番は自機へ扇を、奇数番は輪を撃つ
class EnemyStardust extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 500, Size.S)

        this.setParent(parent, () => vec.arg(this.frame / 60 + (T * index) / 4).scale(110))

        if (index % 2 === 0) {
            this.scripts.add(() => this.fan(), { loop: Infinity, margin: 150 + index * 20 })
        } else {
            this.scripts.add(() => this.ring(), { loop: Infinity, margin: 170 + index * 20 })
        }
    }

    // 最初はゆっくり、一気に速くなる扇
    private *fan() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffe080")
            .p(this.p.clone())
            .speed(1.5)
            .aim(this.game.player)
            .nway(5, T / 24)
            .g((me) => Behavior.ease(me, "speed", 4, 40, Ease.In))
            .fire(this.game.bullets)

        yield* Array(55)
    }

    // 少し止まってから散る輪
    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#b8d8ff")
            .p(this.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(18)
            .g((me) => Behavior.reaccel(me, 20, 20, 30, 3))
            .fire(this.game.bullets)

        yield* Array(80)
    }
}
