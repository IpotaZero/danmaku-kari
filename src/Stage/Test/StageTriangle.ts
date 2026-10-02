import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "../../utils/Functions/GeneratorUtils"
import { Curves } from "../../utils/Functions/Curves"

// 試作「三角」
// 画面の上に弾を並べた正三角形が描かれ、回りながらゆっくり落ちてくる。
// 辺の上は弾が詰まっていて抜けられないので、回る辺の隙間を縫うか、三角形の内側に入ってやり過ごす。
// 隣り合う三角形は逆向きに回るので、間を抜けるときは両方の辺の動きを見る必要がある。

const ENTRANCE_FRAMES = 150
// 1周期の長さ
const CYCLE_FRAMES = 240
// 1周期に落とす三角形の数と、落とす間隔
const TRIANGLE_COUNT = 3
const DROP_INTERVAL = 30
// 三角形の中心から頂点までの距離
const TRIANGLE_RADIUS = 64
// 辺を構成する弾の間隔。自機の当たり判定の8倍より狭いので、辺は抜けられない
const TRIANGLE_SPACING = 16
const FALL_SPEED = 1.6
// 1フレームあたりの回転角
const SPIN = T / 300

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyTriangle(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

// 中心から見た、正三角形の辺の上の弾の位置。頂点を上に向けた形
function triangle(radius: number): Vec[] {
    const vertices = [0, 1, 2].map((k) => vec.arg(-T / 4 + (T * k) / 3).scale(radius))
    const perSide = Math.round((radius * Math.sqrt(3)) / TRIANGLE_SPACING)
    const result: Vec[] = []

    for (let k = 0; k < 3; k++) {
        const from = vertices[k]
        const edge = vertices[(k + 1) % 3].sub(from)

        for (let j = 0; j < perSide; j++) {
            result.push(from.add(edge.scale(j / perSide)))
        }
    }

    return result
}

class EnemyTriangle extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })

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
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    // 画面を三つの列に分け、ばらばらの順番で一つずつ三角形を落とす
    private *cycle() {
        const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)

        yield* GenUtils.all({
            drop: (function* (me: EnemyTriangle) {
                for (let k = 0; k < TRIANGLE_COUNT; k++) {
                    yield* me.drop(lanes[k % lanes.length], k % 2 === 0 ? 1 : -1)
                    yield* Array(DROP_INTERVAL)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 画面の上端に三角形を描き、回しながら落とす。
    // 全員が同じフレームに動き出すので、三角形は形を崩さず一枚の板のように回る
    private *drop(lane: number, direction: number) {
        const width = this.game.WIDTH
        // 回っても頂点が画面の外に出ない(Bulletのboundaryで消えない)位置に置く
        const laneWidth = (width - TRIANGLE_RADIUS * 2) / 3
        const center = vec(
            TRIANGLE_RADIUS + laneWidth * (lane + 0.2 + Math.random() * 0.6),
            TRIANGLE_RADIUS + 8,
        )
        const offsets = triangle(TRIANGLE_RADIUS)

        yield* remodel(this)
            .format("small-ball")
            .color("#bfe9ff")
            .duplicate(offsets.length, (b, i) => {
                b.p = center.add(offsets[i])
                return b
            })
            .g((me, i) => Behavior.revolve(me, center, offsets[i], vec(0, FALL_SPEED), SPIN * direction))
            // 辺をなぞるように順番に現れる(見た目と判定は常に一致)
            .appear(12, 1)
            .fire(this.game.bullets)
    }
}
