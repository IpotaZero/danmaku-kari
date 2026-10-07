import { Vec, vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"

// ステージ「彗星」(流星道場・高弟)
// 高弟(太陽)のすぐそばから、尾を引く彗星が次々に飛び出す。彗星は細長い楕円を描いて画面の下の方まで振れていき、
// また太陽のそばへ戻ってくる。太陽の近くでは速く、遠い所(自機のいる下の方)ではゆっくりになる。
// 彗星は必ず太陽のそばから現れるので、飛び出した向きと回る向きを見れば、どこへ振れてくるかが読める。
// 太陽のまわりを四つの惑星(子機)が回っていて、二つは自機へ扇を、二つは輪を撃ってくる。

export default class extends Stage {
    *G() {
        const sun = new EnemySun(this.game)
        this.game.enemies.push(sun, ...[0, 1, 2, 3].map((i) => new EnemyPlanet(this.game, sun, i)))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemySun extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.06, 2, 3)

    constructor(game: Game) {
        // 主機の体力は子機の総和くらい
        super(game, 2400, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), 120)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 500).add(this.home())
        yield
    }

    // 彗星を五つ、間を空けて放つ。行き先は画面の下の方のあちこち、回る向きは交互。そのあと2秒半ほど休む
    private *cycle() {
        for (let k = 0; k < 5; k++) {
            const aphelion = vec(
                this.game.WIDTH * (0.08 + 0.84 * this.random()),
                this.game.HEIGHT * (0.72 + 0.22 * this.random()),
            )

            yield* this.comet(aphelion, k % 2 === 0 ? 1 : -1)
            yield* Array(28)
        }

        yield* Array(330)
    }

    // 太陽のすぐそば(行き先と反対側)から彗星を飛び出させる。彗星は飛び出した時の太陽の位置に引かれて楕円を描き、
    // 行き先 aphelion(太陽から一番遠い点)まで振れてから、飛び出した所へ戻って消える。turn は回る向き。
    // (動いている太陽に引かせると軌道が乱れて飛んでいってしまうので、引く所は飛び出した時に決める)
    // 太陽のそばは速いので、1フレームを8回に分けて動きを計算する
    private *comet(aphelion: Vec, turn: number) {
        const sun = this.p.clone()

        yield* remodel(this)
            .format("big-ball")
            .r(14)
            .color("#bfe8ff")
            .speed(0)
            .unbounded()
            .g(function* (me) {
                // 太陽から一番近い点(飛び出す所)は、太陽を挟んで行き先と反対側の70px先
                const far = aphelion.sub(sun).magnitude()
                const away = sun.sub(aphelion).normalize()
                const a = (far + 70) / 2
                // 一周(行って戻る)にかかるのは240フレーム
                const gm = (4 * Math.PI ** 2 * a ** 3) / 240 ** 2

                me.p = sun.add(away.scale(70))
                let v = vec.arg(away.radian() + (turn * T) / 4).scale(Math.sqrt(gm * (2 / 70 - 1 / a)))

                yield* Behavior.appear(me, 10)

                for (let f = 0; f < 240; f++) {
                    for (let s = 0; s < 8; s++) {
                        const d = sun.sub(me.p)
                        const r = Math.max(d.magnitude(), 20)
                        v = v.add(d.scale(gm / r ** 3 / 8))
                        me.p = me.p.add(v.scale(1 / 8))
                    }

                    me.radian = v.radian()

                    // 尾。止まった小さな弾をしばらく残す
                    if (f % 2 === 0) {
                        yield* remodel(this)
                            .format("small-ball")
                            .r(5)
                            .color("#bfe8ff")
                            .p(me.p.clone())
                            .speed(0)
                            .g(function* (tail) {
                                yield* Array(36)
                                yield* Behavior.fadeout(tail, 16)
                            })
                            .fire(this.game.bullets)
                    }

                    yield
                }

                yield* Behavior.fadeout(me, 15)
            })
            .fire(this.game.bullets)
    }
}

// 太陽のまわりを回る惑星。偶数番は自機へ扇を、奇数番は輪を撃つ
class EnemyPlanet extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, 600, 22)

        const radius = 90 + 35 * index
        const turn = index % 2 === 0 ? 1 : -1
        this.setParent(parent, () => vec.arg((turn * this.frame) / (60 + 20 * index) + (T * index) / 4).scale(radius))

        if (index % 2 === 0) {
            this.addScript(() => this.fan(), { loop: Infinity, margin: 180 + index * 25 })
        } else {
            this.addScript(() => this.ring(), { loop: Infinity, margin: 200 + index * 25 })
        }
    }

    // ゆっくり出て、一気に速くなる扇
    private *fan() {
        yield* remodel(this)
            .format("donut")
            .color("#ffe8a0")
            .p(this.p.clone())
            .speed(1)
            .aim(this.game.player)
            .nway(5, T / 22)
            .g((me) => Behavior.ease(me, "speed", 6.5, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(70)
    }

    // 一度止まってから散る輪
    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#ffd0a0")
            .p(this.p.clone())
            .speed(4)
            .radian(this.random() * T)
            .ex(20)
            .g((me) => Behavior.reaccel(me, 20, 25, 30, 5))
            .fire(this.game.bullets)

        yield* Array(90)
    }
}
