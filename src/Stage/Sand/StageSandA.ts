import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Sand } from "./Sand"
import { Size } from "../Size"

// ステージ「砂嵐」(砂塵道場・門下生)
// 横に吹き流れる砂の筋が何段も重なった帯が、画面の上から下へゆっくり降りてくる。
// 筋は砂粒が途切れ途切れに並んだもので、段ごとに流れる向きと速さが違う。
// 帯が自機の上を通り過ぎる間、段の間に収まりながら、筋の切れ目へ横に走って一段ずつやり過ごす(蛙が道路を渡るように)。
// 段と段の間には自機がちょうど収まる幅があるので、焦らず一段ずつ。
// 帯は画面の上の外から降りてくるので、近づいてくる間に切れ目の並びを読める。

const ENTRANCE_FRAMES = 150
// 段の間(32px)は自機の当たり判定の8倍よりわずかに広い。筋の砂粒の間隔(10px)は狭いので、切れ目以外は抜けられない
const BAND: Sand.Band = {
    rows: 8,
    rowGap: 80,
    speed: 1.6,
    spacing: 10,
    segment: [90, 170],
    gap: [70, 110],
    flow: [1.2, 2.8],
}
// 1周期の長さ。帯が抜けた後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 900

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.1, 8, 13)

    constructor(game: Game) {
        super(game, 3000, Size.MASTER, { renderer: new EnemyRendererCore() })

        this.scripts.add(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.scripts.add(() => this.move(), { loop: Infinity })
        this.scripts.add(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.12)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 300).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            storm: this.storm(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 段ごとに砂粒の並び(筋と切れ目)を決め、帯ごと上から降ろす
    private *storm() {
        yield* Sand.storm(this, BAND)

        // 帯が自機の上を通るころ、ゆっくりした矢を混ぜる。切れ目へ横に走る途中で、矢の筋も見ることになる
        yield* Array(Math.floor(Sand.travelFrames(this, BAND) * 0.45))

        for (let i = 0; i < 13; i++) {
            yield* remodel(this)
                .format("diamond")
                .color("#fff0d0")
                .p(this.p.clone())
                .speed(1)
                .aim(this.game.player)
                .nway(5, T / 20)
                .g(function* (me) {
                    yield* Behavior.accel(me, 60, 8)
                })
                .fire(this.game.bullets)

            yield* Array(30)
        }
    }
}
