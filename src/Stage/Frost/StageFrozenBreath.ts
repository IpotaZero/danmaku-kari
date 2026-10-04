import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Curves } from "../../utils/Functions/Curves"

// ステージ「凍てつく息」(霜月道場・門下生)
// 門下生が吐いた息(小さな氷の粒)が放射状に広がり、数重の輪を描いたところで凍りついて止まる。
// しばらく宙に留まったあと、凍った粒は並びを保ったまま一斉に真下へ落ちてくる。
// 並びは崩れないので、落ちてくる前に「どの列の隙間に立つか」を決めておけば、ほとんど動かずに抜けられる。
// 凍っている間に一度だけ、ゆっくりした氷柱が自機を狙ってくる。避けたら隙間を選び直す。
// 霜月道場の最初の相手として、「弾幕の提示を読んでから動く」ことだけを教えるステージ。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。落ちた粒がすべて画面下へ抜けた後、少し休憩が入る
const CYCLE_FRAMES = 480
// 息を吐いてから粒が止まり始めるまで。この間は全速で広がる
const SPREAD_FRAMES = 40
// 粒が止まりきるまで
const FREEZE_FRAMES = 20
// 周期の開始から粒が落ち始めるまで。止まってから落ちるまでの間が弾幕の提示
const DROP_FRAMES = 150
// 一重の輪の粒の数
const SHARDS_PER_RING = 24
// 輪の数と、内側/外側の輪の広がる速さ。止まる位置は速さに比例する(およそ速さ×50px)
const RING_COUNT = 4
const INNER_SPEED = 2
const OUTER_SPEED = 6
// 落ちる速さ
const DROP_SPEED = 4

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.25, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        super(game, 3000, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.25)
    }

    // 息を吐く位置が周期ごとに少しずつずれるよう、ゆっくり左右に揺れる
    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            breath: this.breath(),
            icicle: this.icicle(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 放射状に息を吐く。粒は輪ごとに違う速さで広がって止まり、数重の輪になる。
    // 輪ごとに向きを半分ずらすので、落ちてくるときの列が互い違いに並ぶ
    private *breath() {
        const base = this.random() * T

        yield* remodel(this)
            .appearance("ball")
            .color("#dff6ff")
            .p(this.p.clone())
            .r(4)
            .radian(base)
            .ex(SHARDS_PER_RING)
            .duplicate(RING_COUNT, (b, i) => {
                b.speed = INNER_SPEED + ((OUTER_SPEED - INNER_SPEED) * i) / (RING_COUNT - 1)
                b.radian += (i % 2) * (T / SHARDS_PER_RING / 2)
                return b
            })
            .g(function* (me) {
                yield* Array(SPREAD_FRAMES)
                yield* Behavior.stop(me, FREEZE_FRAMES)

                // 凍ったことが一目で分かるよう色を変える(大きさは変えない。見た目と判定を一致させる)
                me.color = "#2bb5ff"
                yield* Array(DROP_FRAMES - SPREAD_FRAMES - FREEZE_FRAMES)

                // 全員が同じフレームに落ち始めるので、並びを保ったまま下へ滑っていく。
                // 画面下に抜けた粒はBulletのboundaryで消える
                me.radian = T / 4
                yield* Behavior.accel(me, 60, DROP_SPEED)
            })
            .fire(this.game.bullets)
    }

    // 凍っている間に一度だけ、ゆっくりした氷柱で自機を狙う。落ちてくる前に隙間を選び直させる役目
    private *icicle() {
        yield* Array(SPREAD_FRAMES + FREEZE_FRAMES + 10)
        if (this.life <= 0) return

        yield* remodel(this)
            .format("diamond")
            .color("#bfe9ff")
            .p(this.p.clone())
            .speed(2.5)
            .aim(this.game.player.p.clone())
            .nway(7, T / 20)
            .fire(this.game.bullets)
    }
}
