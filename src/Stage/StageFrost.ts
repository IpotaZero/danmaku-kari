import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { Remodel, remodel } from "../Game/Remodel"
import { Stage } from "./Stage"
import { EnemyRendererCore } from "../Game/Actor/EnemyRendererCore"
import { T } from "../T"
import { GenUtils } from "../utils/Functions/GeneratorUtils"
import { Curves } from "../utils/Functions/Curves"

// ステージ「霜」
// 空から小さな雪(ball 4)が降り、画面のあちこちで止まって大きな雪玉(ball 24)に育つ。
// 雪玉が画面を埋め尽くしたところで、一斉に下へ落ち始める。
// 画面全体が上から押し寄せてくるので、「居場所」がどんどん削られていく。
// 雪玉がそろうまでの間に、霜の核(ボス)がつららを撃ち込んでくる。
//
// 高速移動で雪玉を抜けても、抜けた先もまた雪玉の中である。弾を消さない限り居場所は増えない。
// 障壁を張れば、落ちてくる雪玉が結界に触れたそばからスコアに変わっていく。
// 「どこに結界を張るか」を、雪が降っている間(提示)に決めるステージ。

const ENTRANCE_FRAMES = 150
// 雪玉がすべて画面下へ抜けた後、約3秒の休憩が入る長さ
const CYCLE_FRAMES = 900
// 雪が降り始めてから降り終わるまで
const SNOW_FRAMES = 150
// 止まった雪が雪玉に育つまで
const GROW_FRAMES = 30
// 周期の開始から雪玉が一斉に落ち始めるまで
const DROP_FRAMES = 420
// 雪(小)が降る速さと、雪玉(大)が落ちる速さ
const FALL_SPEED = 4
const DROP_SPEED = 12
// この面積(px²)につき雪を1つ降らせる。小さいほど多い
const AREA_PER_SNOW = 8000

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyFrost(this.game))

        yield* this.waitAllEnemiesDead()
        this.shake(16, 60)
        this.flash("#dff6ff", 20)
        this.scorenizeAllBullets()
    }
}

class EnemyFrost extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.1, 2, 3)

    constructor(game: Game) {
        super(game, 2400, 48, { renderer: new EnemyRendererCore() })

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
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2400).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            snow: this.snowfall(),
            icicles: this.icicles(),
            ring: this.ring(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 画面上端から雪を降らせる。それぞれが画面のどこかで止まって雪玉に育ち、DROP_FRAMESで一斉に落ちる。
    // 雪は画面の面積に比例した数だけ降るので、画面サイズが変わっても埋まり具合は変わらない
    private *snowfall() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const count = Math.floor((width * height) / AREA_PER_SNOW)

        yield* remodel(this)
            .appearance("ball")
            .r(4)
            .speed(FALL_SPEED)
            .color("#dff6ff")
            .duplicate(count, (b, i) => {
                b.p = vec(Math.random() * width, -3)
                b.radian = T / 4 + (Math.random() - 0.5) * 0.3
                b.delay = Math.floor((i * SNOW_FRAMES) / count)
                return b
            })
            .g(function* (me) {
                const fallFrames = Math.floor((Math.random() * height * 0.95) / FALL_SPEED)
                const stopFrames = 10

                yield* Array(fallFrames)
                yield* Remodel.stop(me, stopFrames)

                me.color = "#8fd8ff"
                yield* Remodel.ease(me, "r", 24, GROW_FRAMES, Ease.Out)

                yield* Array(Math.max(0, DROP_FRAMES - me.delay - fallFrames - stopFrames - GROW_FRAMES))

                // 全員が同じフレームに落ち始めるので、雪玉の並びを保ったまま画面が押し下がってくる。
                // 画面下に抜けた雪玉はBulletのboundaryで消える
                me.radian = T / 4
                yield* Remodel.accel(me, 360, DROP_SPEED)
            })
            .fire(this.game.bullets)
    }

    // 氷がそろったところへ、つららを3回撃ち込む。氷の隙間を縫って避けるか、結界で受け止めるか
    private *icicles() {
        yield* Array(240)

        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .p(this.p.clone())
                .appearance("arrow")
                .collision("arrow")
                .r(24)
                .speed(1.5)
                .color("#bfe9ff")
                .aim(this.game.player.p.clone())
                .nway(7, T / 28)
                .g(function* (me) {
                    yield* Remodel.accel(me, 40, 5)
                })
                .fire(this.game.bullets)

            yield* Array(60)
        }
    }

    // つららの合間に、ゆっくりした輪。自機狙いだけで終わらせないための混ぜもの
    private *ring() {
        yield* Array(270)

        const count = 120

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("donut")
            .r(12)
            .speed(1.4)
            .ex(count)
            .color("#bfe9ff")
            .fire(this.game.bullets)
    }
}
