import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Mirage } from "./Mirage"

// ステージ「逃げ水」(陽炎道場・門下生)
// 画面の真ん中に鏡の線があり、門下生の姿が画面の下の方に幻として映っている。
// 門下生の撃つ弾は、すべて鏡の線を挟んで鏡写しの双子を持つ。上からの弾と、下の幻からの弾が、鏡の線で出会う。
// 弾は陽炎のように揺らめきながら広がる。上下から来るので、鏡の線から少し離れた、上下の輪の間に収まる。
// 幻は撃っても当たらない。本物の門下生を狙う。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。輪が広がりきった後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 480
// 1周期に広げる輪の数と間隔
const RINGS = 3
const RING_INTERVAL = 40
const RING_COUNT = 20
const RING_SPEED = 1.8
// 揺らめきの大きさと速さ
const SHIMMER = 0.35
const SHIMMER_PERIOD = 20
const COLOR: Color = "#ffb070"

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyPupil(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyPupil extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.5, this.game.HEIGHT * 0.2, 3, 4)
    // 鏡の線は画面の真ん中を横に通る。上下対称なので、弾と双子は同時に画面から出る
    private readonly mirror = Mirage.horizontal(this.game)

    constructor(game: Game) {
        super(game, 3000, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
        this.addScript(() => Mirage.lines(this, [this.mirror]))
        this.addScript(() => Mirage.ghosts(this, [this.mirror]))
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.14)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 600).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            rings: this.rings(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 揺らめく輪を広げる。輪ごとに揺らめく向きを逆にする
    private *rings() {
        for (let k = 0; k < RINGS; k++) {
            const sign = k % 2 === 0 ? 1 : -1

            yield* remodel(this)
                .format("diamond")
                .color(COLOR)
                .p(this.p.clone())
                .speed(RING_SPEED)
                .radian(this.random() * T)
                .ex(RING_COUNT)
                .g(function* (me) {
                    const base = me.radian

                    for (let f = 0; ; f++) {
                        me.radian = base + sign * SHIMMER * Math.sin(f / SHIMMER_PERIOD)
                        yield
                    }
                })
                .mirror(this.mirror.center, this.mirror.angle)
                .fire(this.game.bullets)

            yield* Array(RING_INTERVAL)
        }
    }
}
