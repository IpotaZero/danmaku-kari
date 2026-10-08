import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Curves } from "../../utils/Functions/Curves"

// ステージ「六花」(七日前・雪虫の野) 難易度 2/4
// 左右の雪ん子(衛星)が氷の種を投げる。種は画面の下の方で止まり、そこから六本の腕を持つ雪の結晶が育つ。
// 育ちきった結晶は形を保ったまま外へ向かって砕け散る。腕の上は弾が詰まっていて抜けられないので、
// 結晶が育っている間(提示)に「腕と腕の間」に立っておけば、ほとんど動かずに抜けられる。
// 結晶は左右から二つ同時に育つため、両方の腕の間に入れる場所を探すことになる。
// 砕ける瞬間に師範代(ボス)がゆっくりした氷柱を投げてくるので、立ち位置を少しだけ直す必要がある。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。結晶の破片が画面を抜けた後、2秒半ほど休憩が入る
const CYCLE_FRAMES = 470
// 種が飛ぶ平均の速さ。遠くへ投げるほど止まるまでに時間がかかる
const THROW_SPEED = 3.5
// 種を投げてから止まるまでの最大フレーム数。どれだけ遠くても、結晶が育ちきってから砕けるよう抑える
const MAX_THROW_FRAMES = 150
// 結晶が育ちきるまで(弾幕の提示)
const GROW_FRAMES = 50
// 周期の開始から結晶が砕けるまで。一番遠くへ投げても、育ちきってから少し眺める時間がある
const SHATTER_FRAMES = MAX_THROW_FRAMES + GROW_FRAMES + 20
const SHATTER_SPEED = 3.5
// 結晶の腕を構成する弾の間隔。自機の当たり判定の8倍より狭いので、腕は抜けられない
const CRYSTAL_SPACING = 16
// 腕一本あたりの弾の数と、枝が生える位置(腕の根元から何番目の弾か)
const ARM_LENGTH = 6
const BRANCH_AT = [3, 5]
const BRANCH_LENGTH = 2

const FLAKE_LIFE = 500

export default class extends Stage {
    *G() {
        const boss = new EnemyMaster(this.game)
        this.game.enemies.push(boss, new EnemyFlake(this.game, boss, -1), new EnemyFlake(this.game, boss, 1))

        yield* this.waitAllEnemiesDead()
    }
}

// 結晶の形。中心から見た弾の位置を返す
function crystal(base: number): Vec[] {
    const result: Vec[] = []

    for (let k = 0; k < 6; k++) {
        const arm = base + (T / 6) * k

        for (let i = 1; i <= ARM_LENGTH; i++) {
            result.push(vec.arg(arm).scale(CRYSTAL_SPACING * i))
        }

        for (const at of BRANCH_AT) {
            const root = vec.arg(arm).scale(CRYSTAL_SPACING * at)

            for (const side of [-1, 1]) {
                for (let j = 1; j <= BRANCH_LENGTH; j++) {
                    result.push(root.add(vec.arg(arm + (side * T) / 6).scale(CRYSTAL_SPACING * j)))
                }
            }
        }
    }

    return result
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.4, 4, 7)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, FLAKE_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.4)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 600).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            icicle: this.icicle(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 結晶が砕ける瞬間に、ゆっくりした氷柱で自機を狙う。腕の間で立ち止まっているだけでは済まなくする
    private *icicle() {
        yield* Array(SHATTER_FRAMES)

        yield* remodel(this)
            .format("arrow")
            .color("#bfe9ff")
            .p(this.p.clone())
            .aim(this.game.player)
            .duplicate(3, (me, i) => {
                me.radian = T * (i / 3)
                me.speed = 4 + 4 * (i / 3)
                return me
            })
            .ex(13)
            .g((me) => Behavior.reaccel(me, 30, 60, 60, 6))
            .fire(this.game.bullets)
    }
}

class EnemyFlake extends Enemy {
    // side: -1で左、1で右。自分の側の半分に結晶を育てる
    constructor(game: Game, parent: Enemy, side: number) {
        super(game, FLAKE_LIFE, 20)

        this.setParent(parent, () => vec(side * game.WIDTH * 0.3, game.HEIGHT * 0.03 * Math.sin(this.frame / 200)))

        this.addScript(() => this.cycle(side), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(side: number) {
        yield* GenUtils.all({
            snowflake: this.snowflake(side),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 種を投げ、止まった場所に結晶を育て、砕く
    private *snowflake(side: number) {
        if (this.life <= 0) return

        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const center = vec(
            width * (0.5 + side * (0.1 + this.random() * 0.25)),
            height * (0.45 + this.random() * 0.25),
        )

        const throwFrames = Math.min(Math.ceil(center.sub(this.p).magnitude() / THROW_SPEED), MAX_THROW_FRAMES)

        yield* this.seed(center, throwFrames)
        yield* this.grow(center, throwFrames)
    }

    // 種は投げた瞬間から等しく減速して、ちょうどcenterで止まる。止まったら結晶に置き換わって消える
    private *seed(center: Vec, throwFrames: number) {
        yield* remodel(this)
            .format("diamond")
            .color("#dff6ff")
            .p(this.p.clone())
            .g(function* (me) {
                yield* Behavior.throwTo(me, center, throwFrames)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(this.game.bullets)

        yield* Array(throwFrames)
    }

    // 中心から外へ向かって腕が伸びるように育つ。砕けるときは中心から離れる向きに飛ぶので、形を保ったまま広がっていく
    private *grow(center: Vec, throwFrames: number) {
        const offsets = crystal(this.random() * T)
        const maxDistance = Math.max(...offsets.map((o) => o.magnitude()))

        yield* remodel(this)
            .format("small-ball")
            .color("#8fd8ff")
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = center.add(offsets[i])
                b.radian = offsets[i].radian()
                b.delay = Math.floor((offsets[i].magnitude() / maxDistance) * GROW_FRAMES)
                return b
            })
            .g(function* (me) {
                const appearFrames = 12
                // 自機の真上に突然出現しないよう、大きさ0から現れる(見た目と判定は常に一致)
                yield* Behavior.appear(me, appearFrames)
                yield* Array(Math.max(0, SHATTER_FRAMES - throwFrames - me.delay - appearFrames))

                me.color = "#dff6ff"
                yield* Behavior.accel(me, 30, SHATTER_SPEED)
            })
            .fire(this.game.bullets)
    }
}
