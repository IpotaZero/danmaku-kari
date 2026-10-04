import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Curves } from "../../utils/Functions/Curves"

// ステージ「門」(高難度)
// 画面の左右の端に4本の門柱(衛星)が立ち、それぞれが画面の縦いっぱいに弾を並べて壁を描く。
// 壁には一か所だけ「門」(隙間)が開いており、壁は左右交互に一枚ずつ画面を横切っていく。
// 門の高さは壁ごとにばらばらなので、門をくぐった直後に次の門へ縦に走り、低速で位置を合わせる必要がある。
// 自分の横位置で「どの壁とどの順番ですれ違うか」が変わるので、壁が描かれている間(提示)に通り道を決めるステージ。
// そこへ門番(ボス)がゆっくりした輪を重ね、門に合わせる集中を乱してくる。
// 門柱を落とせばその壁は出なくなる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。門番と門柱は互いを参照せず、同じ周期で回ることで同期する
const CYCLE_FRAMES = 500
// 壁を描き終えるまでのフレーム数(弾幕の提示)
const DRAW_FRAMES = 40
// 周期の開始から1枚目の壁が動き出すまで
const LAUNCH_FRAMES = 100
// 壁が動き出す間隔。門柱の番号順に動き出す
const LAUNCH_INTERVAL = 40
const WALL_SPEED = 5
// 壁を構成する弾の間隔。自機の当たり判定の8倍より十分狭いので、門以外は抜けられない
const WALL_SPACING = 16
// 門(隙間)の高さ
const GATE_SIZE = 60
// 自機の高さから見た、各門柱の門の位置のずれ。左右交互に大きく上下させる
const GATE_OFFSETS = [0, 190, -130, 230]

const PILLAR_COUNT = 4
const PILLAR_LIFE = 400

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyGatekeeper(this.game))

        for (let i = 0; i < PILLAR_COUNT; i++) {
            this.game.enemies.push(new EnemyPillar(this.game, i))
        }

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyGatekeeper extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, PILLAR_LIFE * PILLAR_COUNT, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    // 壁が描き終わって動き出す直前と、壁どうしがすれ違っている最中の2回、輪を放つ
    private *cycle() {
        yield* GenUtils.all({
            attack: (function* (me: EnemyGatekeeper) {
                yield* Array(LAUNCH_FRAMES - 30)
                yield* me.ring(0)
                yield* Array(70)
                yield* me.ring(0.5)
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *ring(offset: number) {
        const count = 16

        yield* remodel(this)
            .appearance("donut")
            .color("#ff8a6b")
            .p(this.p.clone())
            .r(12)
            .speed(2.2)
            .radian((T / count) * offset + this.random() * T)
            .ex(count)
            .fire(this.game.bullets)
    }
}

class EnemyPillar extends Enemy {
    constructor(game: Game, index: number) {
        super(game, PILLAR_LIFE, 20)

        this.addScript(() => this.enter(index))
    }

    private *enter(index: number) {
        yield* this.moveTo(this.home(index), ENTRANCE_FRAMES)

        this.addScript(() => this.move(index), { loop: Infinity })
        this.addScript(() => this.cycle(index), { loop: Infinity })
    }

    // 偶数番は左端、奇数番は右端。上下2段に並ぶ
    private home(index: number) {
        const isLeft = index % 2 === 0
        const row = Math.floor(index / 2)

        return vec(this.game.WIDTH * (isLeft ? 0.06 : 0.94), this.game.HEIGHT * (0.25 + row * 0.2))
    }

    // 狙いやすいよう、ごくゆっくり上下するだけ
    private *move(index: number) {
        const t = (this.frame - ENTRANCE_FRAMES) / 240 + index
        this.p = this.home(index).add(vec(0, Math.sin(t) * this.game.HEIGHT * 0.04))
        yield
    }

    private *cycle(index: number) {
        yield* GenUtils.all({
            wall: this.wall(index),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自分の高さから上下へ広がるように縦一列の壁を描き、自分の番が来たら反対側の端へ向けて動かす
    private *wall(index: number) {
        if (this.life <= 0) return

        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const origin = this.p.clone()
        const radian = origin.x < width / 2 ? 0 : T / 2
        const launch = LAUNCH_FRAMES + index * LAUNCH_INTERVAL

        // 門は画面の上の方(門番の周り)には開けない。範囲からはみ出した分は反対側へ回り込ませる
        const top = height * 0.3
        const range = height - 32 - top
        const offset = GATE_OFFSETS[index] + (this.random() - 0.5) * 48
        const gateY = top + ((((this.game.player.p.y + offset - top) % range) + range) % range)

        const ys = Array.from({ length: Math.ceil(height / WALL_SPACING) }, (_, i) => (i + 0.5) * WALL_SPACING).filter(
            (y) => Math.abs(y - gateY) > GATE_SIZE / 2,
        )

        yield* remodel(this)
            .appearance("ball")
            .color("#ffcf6b")
            .r(4)
            .speed(0)
            .radian(radian)
            .duplicate(ys.length, (b, i) => {
                b.p = vec(origin.x, ys[i])
                b.delay = Math.floor((Math.abs(ys[i] - origin.y) / height) * DRAW_FRAMES)
                return b
            })
            .g(function* (me) {
                const appearFrames = 16
                // 自機の真上に突然出現しないよう、大きさ0から現れる(見た目と判定は常に一致)
                yield* Behavior.appear(me, appearFrames)
                yield* Array(Math.max(0, launch - me.delay - appearFrames))
                yield* Behavior.accel(me, 30, WALL_SPEED)
            })
            .fire(this.game.bullets)
    }
}
