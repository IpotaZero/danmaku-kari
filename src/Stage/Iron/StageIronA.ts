import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Shield } from "./Shield"

// ステージ「盾」(鉄壁道場・門下生)
// 門下生のまわりを、弾を並べた盾の輪がゆっくり回っている。盾は自機の弾を受け止めるので、輪の二か所の窓からしか弾は届かない。
// 門下生も窓から外へ向けて弾を撃つ。窓が回るので、弾の筋は灯台の光のように画面を薙いでいく。
// 窓と向き合えば撃ち込めるが、そこは弾の筋の通り道でもある。筋が止んでいる間に窓の正面へ回り込んで撃ち込む。
// 撃ち合いの合間に、門下生はゆっくりした輪も放つ(輪は盾をすり抜ける)。

const ENTRANCE_FRAMES = 150
// 盾の輪の半径と、輪に並べる弾の数・窓の幅(弾何個ぶんを抜くか)
const SHIELD_RADIUS = 84
const SHIELD_SLOTS = 28
const WINDOW_SLOTS = 4
// 1フレームあたりの盾の回転
const SHIELD_SPIN = T / 720
// 窓から弾を撃ち続ける時間と、休む時間
const FIRE_FRAMES = 90
const REST_FRAMES = 110
const STREAM_INTERVAL = 5
const STREAM_SPEED = 3.5
const COLOR: Color = "#9ab8ff"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)
    private readonly shieldPhase = this.random() * T

    constructor(game: Game) {
        super(game, 2400, 40, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.shield())
        this.addScript(() => this.cycle(), { loop: Infinity, margin: 60 })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    // 盾の輪の傾き。窓の真ん中の向きは、これと、これを半周回した向き
    private shieldAngle() {
        return this.shieldPhase + SHIELD_SPIN * this.frame
    }

    // 窓のところを抜いて、盾の輪を並べる。輪は門下生について回る
    private *shield() {
        const pupil = this
        const slots = Array.from({ length: SHIELD_SLOTS }, (_, k) => k).filter(
            (k) => Math.abs((k % (SHIELD_SLOTS / 2)) - (SHIELD_SLOTS / 4 - 0.5)) >= WINDOW_SLOTS / 2,
        )

        yield* remodel(this)
            .format("donut")
            .color(Shield.COLOR)
            .speed(0)
            .isScorable(false)
            .duplicate(slots.length)
            .g(function* (me, i) {
                const angle = (T * (slots[i] + 0.5)) / SHIELD_SLOTS - T / 4

                yield* GenUtils.all({
                    block: Shield.block(me),
                    follow: (function* () {
                        while (pupil.life > 0) {
                            me.p = pupil.p.add(vec.arg(pupil.shieldAngle() + angle).scale(SHIELD_RADIUS))
                            yield
                        }
                    })(),
                })
            })
            .appear(30)
            .fire(this.game.bullets)
    }

    private *cycle() {
        yield* GenUtils.all({
            stream: this.stream(),
            ring: this.ring(),
            wait: Array(FIRE_FRAMES + REST_FRAMES),
        })
    }

    // 二つの窓から、外へ向けて弾を撃ち続ける
    private *stream() {
        for (let f = 0; f < FIRE_FRAMES; f += STREAM_INTERVAL) {
            const angle = this.shieldAngle()

            yield* remodel(this)
                .format("diamond")
                .color(COLOR)
                .p(this.p.add(vec.arg(angle).scale(SHIELD_RADIUS)))
                .radian(angle)
                .speed(STREAM_SPEED)
                .nway(3, T / 40)
                .duplicate(2, (b, i) => {
                    if (i === 1) {
                        b.p = this.p.add(vec.arg(angle + T / 2).scale(SHIELD_RADIUS))
                        b.radian += T / 2
                    }
                    return b
                })
                .fire(this.game.bullets)

            yield* Array(STREAM_INTERVAL)
        }
    }

    // 休んでいる間に、盾をすり抜けるゆっくりした輪を放つ
    private *ring() {
        yield* Array(FIRE_FRAMES + 20)

        yield* remodel(this)
            .format("small-ball")
            .color("#e0e8ff")
            .p(this.p.clone())
            .speed(1.6)
            .radian(this.random() * T)
            .ex(32)
            .g((me) => Behavior.appear(me, 20))
            .fire(this.game.bullets)
    }
}
