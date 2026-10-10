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
import { Size } from "../Size"

// ステージ「月見」(月影道場・門下生)
// 門下生のまわりを、四つの月(子機)が横長の楕円を描いて回る。月は順に、三日月の形に並んだ弾を自機へ飛ばしてくる。
// 三日月は形を保ったまま、最初はゆっくり、だんだん速く飛んでくる。月があちこちを回っているので、三日月はいろいろな向きから来る。
// 門下生は、一度止まってから散る輪を放つ。月を落とせば、その三日月はなくなる。

export default class extends Stage {
    *G() {
        const pupil = new EnemyPupil(this.game)
        this.game.enemies.push(pupil, ...pupil.moons)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 2, 3)

    // 月。門下生のまわりの横長の楕円を回る
    readonly moons = [0, 1, 2, 3].map(
        (i) =>
            new Part(
                this.game,
                this,
                400,
                Size.S,
                (me) => {
                    const angle = me.frame / 70 + (T * i) / 4
                    return vec(Math.cos(angle) * 190, Math.sin(angle) * 80)
                },
                (me) => this.crescent(me, i),
                140 + i * 30,
            ),
    )

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 1400, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 350).add(this.home())
        yield
    }

    // 三日月。自機の方へ膨らんだ弧に九つの弾を並べ、形を保ったまま飛ばす。月ごとに色を変える
    private *crescent(me: Part, i: number) {
        const aim = this.game.player.p.sub(me.p).radian()

        yield* remodel(me)
            .format("diamond")
            .color((["#fff2c0", "#e0d8ff", "#c8e8ff", "#ffd8e8"] as Color[])[i])
            .speed(1.5)
            .radian(aim)
            .duplicate(9, (b, k) => {
                b.p = me.p.add(vec.arg(aim + (k - 4) * 0.28).scale(32))
                return b
            })
            .appear(60)
            .g((b) => Behavior.ease(b, "speed", 6.5, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(120)
    }

    // 一度止まってから散る輪
    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#e0d8ff")
            .p(this.p.clone())
            .speed(4.5)
            .radian(this.random() * T)
            .ex(37)
            .g((me) => Behavior.reaccel(me, 20, 25, 30, 5))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
