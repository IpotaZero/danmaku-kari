import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"

// ステージ「鎌鼬」(疾風道場・高弟)
// 左右の鼬(衛星)が、弾を弧に並べた鎌を投げる。鎌は回りながら自機のそばまで飛び、輪を描いて鼬の手元へ戻ってくる。
// 鎌の刃は弾が詰まっていて抜けられない。行きと帰りで違う側を通るので、一度かわしても帰りの鎌がもう一度来る。
// 鎌は鼬の手元で研がれて(大きさ0から育って)から飛ぶので、それが提示になる。
// 左右の鎌は少しずらして投げられ、自機のそばで交差する。そこへ高弟(ボス)がゆっくりした輪を重ねてくる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。鎌が戻りきった後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 460
// 鎌を研いでいる時間(提示)と、投げてから戻るまでの時間
const SHARPEN_FRAMES = 40
const FLIGHT_FRAMES = 160
// 右の鼬が投げるのを遅らせる
const THROW_LAG = 50
// 鎌の刃。半径 BLADE_RADIUS の円弧を BLADE_SPAN だけ切り取った形に、BLADE_SPACING おきに弾を並べる。
// 刃の弾の間隔は自機の当たり判定の8倍より狭いので、刃は抜けられない
const BLADE_RADIUS = 80
const BLADE_SPAN = T / 3
const BLADE_SPACING = 14
// 1フレームあたりの鎌の回転
const SPIN = T / 70
// 鎌が描く輪の膨らみ。行きと帰りで通り道がこれだけずれる
const LOOP_SWELL = 110
// 自機からどれだけずれた場所を狙うか
const AIM_SPREAD = 60

const WEASEL_LIFE = 900

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyWeasel(this.game, master, -1), new EnemyWeasel(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

// 鎌の形。回転の中心(刃の重心)から見た弾の位置を返す
function blade(): Vec[] {
    const count = Math.ceil((BLADE_RADIUS * BLADE_SPAN) / BLADE_SPACING)
    const centroid = vec((BLADE_RADIUS * Math.sin(BLADE_SPAN / 2)) / (BLADE_SPAN / 2), 0)

    return Array.from({ length: count + 1 }, (_, i) =>
        vec
            .arg(BLADE_SPAN * (i / count - 0.5))
            .scale(BLADE_RADIUS)
            .sub(centroid),
    )
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, WEASEL_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 鎌が自機のそばで交差するころに、ゆっくりした輪を2つ重ねる
    private *rings() {
        yield* Array(SHARPEN_FRAMES + 50)

        for (let k = 0; k < 2; k++) {
            const count = 24

            yield* remodel(this)
                .format("donut")
                .color("#b8ffd8")
                .p(this.p.clone())
                .speed(2)
                .radian((T / count) * (k / 2) + this.random() * T)
                .ex(count)
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }
}

class EnemyWeasel extends Enemy {
    // side: -1で左、1で右
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, WEASEL_LIFE, 24)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.32, game.HEIGHT * 0.04 * Math.sin(this.frame / 150)))

        this.addScript(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            sickle: this.sickle(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 手元で鎌を研ぎ、自機のそばへ向けて投げる。鎌は輪を描いて投げた場所へ戻る
    private *sickle(side: number) {
        if (side > 0) yield* Array(THROW_LAG)
        if (this.life <= 0) return

        const start = this.p.clone()
        const target = this.game.player.p.add(vec.arg(this.random() * T).scale(this.random() * AIM_SPREAD))
        const forward = target.sub(start)
        // 左右の鼬で鏡写しの輪を描く
        const normal = vec(-forward.y, forward.x).normalize().scale(side)
        const course = (t: number) =>
            start.add(forward.scale(Math.sin(Math.PI * t))).add(normal.scale(LOOP_SWELL * Math.sin(T * t)))

        const offsets = blade()
        const base = this.random() * T
        const spin = SPIN * -side

        yield* remodel(this)
            .format("wedge")
            .color("#b8ffd8")
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = start.add(offsets[i].rotate(base))
                b.radian = offsets[i].radian() + base + T / 4
                return b
            })
            .g(function* (me, i) {
                // 刃が画面の外へはみ出しても、戻ってくるまで消さない
                me.removeScript("boundary")
                yield* Behavior.appear(me, SHARPEN_FRAMES)

                for (let f = 1; f <= FLIGHT_FRAMES; f++) {
                    const angle = base + spin * f
                    me.p = course(f / FLIGHT_FRAMES).add(offsets[i].rotate(angle))
                    me.radian = offsets[i].radian() + angle + T / 4
                    yield
                }

                yield* Behavior.fadeout(me, 15)
            })
            .fire(this.game.bullets)
    }
}
