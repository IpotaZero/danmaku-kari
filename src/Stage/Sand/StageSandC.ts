import { Vec, vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"

// ステージ「砂時計」(砂塵道場・師範代)
// 画面いっぱいに、弾を並べた大きな砂時計が描かれる。師範代(ボス)は砂時計のくびれに陣取り、そこから砂を真下へ落とし続ける。
// しばらくすると砂時計はゆっくり半回転してひっくり返る。砂時計の線は抜けられないので、線に押されないよう一緒に回る。
// 下のふくらみにいたまま一緒に回ると、ひっくり返ったときには師範代の真上にいて、弾が当たらなくなる。
// 撃ち込みたければ、くびれ(師範代のすぐ横の、自機がやっと通れる隙間)をくぐって下のふくらみへ移る。
// 砂時計の外側(左右のくさび形のところ)へ出てやり過ごすこともできるが、そこにも回る線が来る。
// 師範代のまわりを回る2つの砂粒(衛星)が、ゆっくりした砂を自機へ投げてくる。

const ENTRANCE_FRAMES = 150
// 砂時計が薄い姿で描かれている時間(提示)
const DRAW_FRAMES = 60
// 砂を落とし続ける時間と、ひっくり返るのにかかる時間。これを2回くり返す
const HOLD_FRAMES = 160
const FLIP_FRAMES = 360
const FADE_FRAMES = 30
const HOURGLASS_FRAMES = DRAW_FRAMES + (HOLD_FRAMES + FLIP_FRAMES) * 2
// 1周期の長さ。砂時計が消えた後、3秒ほど休憩が入る
const CYCLE_FRAMES = HOURGLASS_FRAMES + FADE_FRAMES + 180
// 砂時計の大きさ(画面に対する割合)と、くびれの隙間の半分の幅
const HALF_WIDTH = 0.44
const HALF_HEIGHT = 0.42
const NECK = 22
// 線を構成する弾の間隔。自機の当たり判定の8倍より狭いので、線は抜けられない
const SPACING = 16
// 砂を落とす間隔と速さ。砂の筋の弾の間隔は両者の積(12px)
const POUR_INTERVAL = 4
const POUR_SPEED = 3
const SAND: Color = "#ffd890"

const GRAIN_LIFE = 700

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyGrain(this.game, master, 0), new EnemyGrain(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

// 砂時計の形と回り方
namespace Hourglass {
    // 中心から見た、砂時計の線の上の弾の位置。くびれは上下のふくらみの間に NECK の隙間を空ける
    export function shape(halfWidth: number, halfHeight: number): Vec[] {
        const corners = [vec(-halfWidth, -halfHeight), vec(halfWidth, -halfHeight)]
        const segments: [Vec, Vec][] = []

        for (const sign of [-1, 1]) {
            const [left, right] = corners.map((c) => vec(c.x, c.y * -sign))
            segments.push([left, right])
            segments.push([left, vec(-NECK, 0)])
            segments.push([right, vec(NECK, 0)])
        }

        return segments.flatMap(([from, to]) => {
            const edge = to.sub(from)
            const count = Math.ceil(edge.magnitude() / SPACING)
            return Array.from({ length: count + 1 }, (_, i) => from.add(edge.scale(i / count)))
        })
    }

    // 周期の始まりから t フレーム後の、砂時計の傾き。directions は1回目・2回目にひっくり返る向き
    export function angle(t: number, directions: number[]): number {
        let result = 0
        let start = DRAW_FRAMES + HOLD_FRAMES

        for (const direction of directions) {
            const progress = Math.min(Math.max((t - start) / FLIP_FRAMES, 0), 1)
            result += direction * (T / 2) * Ease.InOut(progress)
            start += FLIP_FRAMES + HOLD_FRAMES
        }

        return result
    }

    // 周期の始まりから t フレーム後に、砂を落としているかどうか
    export function isPouring(t: number): boolean {
        const u = t - DRAW_FRAMES
        if (u < 0) return false
        return u % (HOLD_FRAMES + FLIP_FRAMES) < HOLD_FRAMES && u < (HOLD_FRAMES + FLIP_FRAMES) * 2
    }
}

class EnemyMaster extends Enemy {
    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, GRAIN_LIFE * 2, 40, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    // 砂時計のくびれ(画面の真ん中)
    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
    }

    private *cycle() {
        const directions = [0, 1].map(() => (this.random() < 0.5 ? -1 : 1))

        yield* GenUtils.all({
            hourglass: this.hourglass(directions),
            pour: this.pour(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 砂時計を描き、くびれを中心に回す。すべての弾が同じ傾きを見るので、形を保ったまま回る
    private *hourglass(directions: number[]) {
        const center = this.home()
        const offsets = Hourglass.shape(this.game.WIDTH * HALF_WIDTH, this.game.HEIGHT * HALF_HEIGHT)

        yield* remodel(this)
            .format("small-ball")
            .color(SAND)
            .speed(0)
            .type("neutral")
            .alpha(0.3)
            .duplicate(offsets.length, (b, i) => {
                b.p = center.add(offsets[i])
                return b
            })
            .g(function* (me, i) {
                // 回ると端が画面の外へはみ出すので、端で消さない
                me.removeScript("boundary")

                // 大きさ0から現れる(見た目と判定は常に一致)。薄い間は当たり判定がない
                yield* Behavior.appear(me, DRAW_FRAMES / 2)
                yield* Array(DRAW_FRAMES / 2)
                me.type = "enemy"
                me.alpha = 1

                for (let t = DRAW_FRAMES; t < HOURGLASS_FRAMES; t++) {
                    me.p = center.add(offsets[i].rotate(Hourglass.angle(t, directions)))
                    yield
                }

                yield* Behavior.fadeout(me, FADE_FRAMES)
            })
            .fire(this.game.bullets)
    }

    // 砂時計が立っている間、くびれから砂を真下へ落とす。砂は下のふくらみの底で消える
    private *pour() {
        const floor = this.game.HEIGHT * (0.5 + HALF_HEIGHT)

        for (let t = 0; t < HOURGLASS_FRAMES; t += POUR_INTERVAL) {
            if (Hourglass.isPouring(t)) {
                yield* remodel(this)
                    .format("small-ball")
                    .color(SAND)
                    .p(this.p.add(vec((this.random() - 0.5) * 8, 0)))
                    .radian(T / 4)
                    .speed(POUR_SPEED)
                    .g(function* (me) {
                        while (me.p.y < floor) yield
                        me.life = 0
                    })
                    .fire(this.game.bullets)
            }

            yield* Array(POUR_INTERVAL)
        }
    }
}

class EnemyGrain extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, GRAIN_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 120 + (T / 2) * index).scale(90))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + DRAW_FRAMES + index * 50, loop: Infinity })
    }

    // ゆっくりした砂を3粒、自機へ投げる
    private *cycle() {
        yield* remodel(this)
            .format("diamond")
            .color("#fff0c0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(3, T / 18)
            .g((me) => Behavior.accel(me, 60, 2.6))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}
