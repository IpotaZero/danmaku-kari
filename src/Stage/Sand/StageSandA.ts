import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"

// ステージ「砂嵐」(砂塵道場・門下生)
// 横に吹き流れる砂の筋が何段も重なった帯が、画面の上から下へゆっくり降りてくる。
// 筋は砂粒が途切れ途切れに並んだもので、段ごとに流れる向きと速さが違う。
// 帯が自機の上を通り過ぎる間、段の間に収まりながら、筋の切れ目へ横に走って一段ずつやり過ごす(蛙が道路を渡るように)。
// 段と段の間には自機がちょうど収まる幅があるので、焦らず一段ずつ。
// 帯は画面の上の外から降りてくるので、近づいてくる間に切れ目の並びを読める。

const ENTRANCE_FRAMES = 150
// 帯の段数と、段の間隔。段の間(32px)は自機の当たり判定の8倍よりわずかに広い
const ROWS = 8
const ROW_GAP = 40
// 帯が降りる速さ
const BAND_SPEED = 1.6
// 筋の砂粒の間隔。自機の当たり判定の8倍より狭いので、切れ目以外は抜けられない
const GRAIN_SPACING = 10
// 筋の砂粒が続く長さと、切れ目の長さ
const SEGMENT = [90, 170]
const GAP = [70, 110]
// 段ごとの流れる速さ
const FLOW_SPEED = [1.2, 2.8]
// 1周期の長さ。帯が抜けた後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 900

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.05, 1, 2)

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
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            storm: this.storm(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private between([min, max]: number[]) {
        return min + this.random() * (max - min)
    }

    // 段ごとに砂粒の並び(筋と切れ目)を決め、帯ごと上から降ろす。
    // 筋は横に一周する輪のように流れ、画面の端から出た砂粒は反対の端から戻ってくる
    private *storm() {
        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const top = -ROWS * ROW_GAP
        const travel = Math.ceil((height - top + ROW_GAP) / BAND_SPEED)

        for (let row = 0; row < ROWS; row++) {
            const grains: number[] = []
            let s = 0

            // 画面幅より少し長い輪の上に、筋と切れ目を交互に並べる
            while (s < width + 80) {
                const segment = this.between(SEGMENT)
                for (let d = 0; d < segment; d += GRAIN_SPACING) grains.push(s + d)
                s += segment + this.between(GAP)
            }

            const loop = s
            const flow = this.between(FLOW_SPEED) * (row % 2 === 0 ? 1 : -1)
            const y = top + row * ROW_GAP

            yield* remodel(this)
                .format("small-ball")
                .color("#ffd890")
                .speed(0)
                .duplicate(grains.length, (b, i) => {
                    b.p = vec(grains[i] - (loop - width) / 2, y)
                    return b
                })
                .g(function* (me, i) {
                    // 帯は画面の外から入ってきて外へ抜けていくので、端で消さない
                    me.removeScript("boundary")

                    for (let t = 0; t < travel; t++) {
                        const along = (((grains[i] + flow * t) % loop) + loop) % loop
                        me.p = vec(along - (loop - width) / 2, y + BAND_SPEED * t)
                        yield
                    }

                    me.life = 0
                })
                .fire(this.game.bullets)
        }

        // 帯が自機の上を通るころ、ゆっくりした矢を混ぜる。切れ目へ横に走る途中で、矢の筋も見ることになる
        yield* Array(Math.floor(travel * 0.45))
        yield* remodel(this)
            .format("arrow")
            .color("#fff0d0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(5, T / 20)
            .g((me) => Behavior.accel(me, 60, 2.5))
            .fire(this.game.bullets)
    }
}
