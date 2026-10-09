import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mist } from "./Mist"

// ステージ「霞隠れ」(霧隠道場・師範代)
// 師範代のまわりに4体の分身(衛星)が並ぶ。分身は自機のまわりへ、霧の手裏剣(薄く、当たり判定なし)を投げる。
// 手裏剣は自機から少し離れた場所に刺さると実体になり、しばらくして輪になって弾け飛ぶ。
// 刺さる場所は霧のうちに見えるので、どこから輪が来るかを先に読める。輪はあちこちから時間差で来るので、すき間を探して抜ける。
// 分身のうち本物は一度に1体だけで、ほかは攻撃が効かない(体力の帯が赤い)。本物は周期ごとに入れ替わるので、狙い直す必要がある。
// 師範代(ボス)は、手裏剣が弾け終わるころにゆっくりした輪を放つ。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。最後の輪が広がった後、2秒ほど休憩が入る
const CYCLE_FRAMES = 540
// 分身が手裏剣を投げる時刻。分身の番号ごとにずらし、1周期に2巡する
const THROW_INTERVAL = 20
const ROUND_INTERVAL = 110
// 手裏剣が刺さる場所の、自機からの距離
const LAND_MIN = 90
const LAND_MAX = 170
// 手裏剣は40フレーム霧のまま飛び、刺さって45フレーム後に弾ける
const SHURIKEN: Mist.Shuriken = { flight: 90, stuck: 45, burstCount: 14, burstSpeed: 1.8, color: "#e0e0ff" }

const CLONE_COUNT = 4
const CLONE_LIFE = 450
// 師範代から見た、分身の位置
const CLONE_OFFSETS = [vec(-0.36, 0.02), vec(0.36, 0.02), vec(-0.18, 0.14), vec(0.18, 0.14)]

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, ...master.clones)

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)
    readonly clones = CLONE_OFFSETS.map((o, i) => new EnemyClone(this.game, this, o, i))

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, CLONE_LIFE * CLONE_COUNT, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.13)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    private *cycle() {
        this.chooseReal()

        yield* GenUtils.all({
            ring: this.ring(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 生きている分身から本物を1体選び、ほかは攻撃が効かないようにする
    private chooseReal() {
        const alive = this.clones.filter((c) => c.life > 0)
        if (alive.length === 0) return

        const real = alive[Math.floor(this.random() * alive.length)]
        alive.forEach((c) => {
            c.isInvincible = c !== real
        })
    }

    private *ring() {
        yield* Array(ROUND_INTERVAL + THROW_INTERVAL * CLONE_COUNT + SHURIKEN.flight + SHURIKEN.stuck)

        yield* remodel(this)
            .format("donut")
            .color("#e0e0ff")
            .p(this.p.clone())
            .speed(2)
            .radian(this.random() * T)
            .ex(23)
            .delayByIndex(10)
            .ex(13)
            .fire(this.game.bullets)
    }
}

class EnemyClone extends Enemy {
    constructor(game: Game, parent: Enemy, offset: Vec, index: number) {
        super(game, CLONE_LIFE, 24)

        this.setParent(parent, () =>
            vec(offset.x * game.WIDTH, (offset.y + 0.02 * Math.sin(this.frame / 90 + index)) * game.HEIGHT),
        )

        this.addScript(() => this.cycle(index), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(index: number) {
        yield* GenUtils.all({
            first: this.shuriken(THROW_INTERVAL * index),
            second: this.shuriken(ROUND_INTERVAL + THROW_INTERVAL * index),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自機から少し離れた場所へ霧の手裏剣を投げる。刺さると実体になり、少しして輪になって弾ける
    private *shuriken(wait: number) {
        yield* Array(wait)
        if (this.life <= 0) return

        const target = this.game.player.p.add(
            vec.arg(this.random() * T).scale(LAND_MIN + this.random() * (LAND_MAX - LAND_MIN)),
        )

        yield* Mist.shuriken(remodel(this), this.game, this.p.clone(), target, SHURIKEN).fire(this.game.bullets)
    }
}
