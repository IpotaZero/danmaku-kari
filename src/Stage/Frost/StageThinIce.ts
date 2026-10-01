import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "../../utils/Functions/GeneratorUtils"
import { Curves } from "../../utils/Functions/Curves"

// ステージ「薄氷」(霜月道場・師範代) 難易度 3/4
// 道場の床は一面に張った薄い氷。師範代(ボス)の周りを回る4本の氷槌(衛星)が、順番に自機の近くの床を叩く。
// 叩かれた場所からはひびが走り、ひびはそのまま弾の壁として床に残る。ひびの弾は詰まっていて抜けられない。
// ひびが増えるたびに動ける場所が削られていき、その狭い場所で師範代の弾を避けることになる。
// ひびは1本ずつ順番に走るので、「次のひびがどこに走るか」を見ながら、輪と氷柱を避けなければならない。
// ひびは一度走ったら動かない。しばらくすると割れた氷は沈んでひびが消え、休憩になる。
// 氷槌を落とせば、そのひびは走らなくなる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。ひびが沈んだ後、3秒ほど休憩が入る
const CYCLE_FRAMES = 740
// 氷槌が床を叩く間隔。氷槌の番号順に叩く
const STRIKE_INTERVAL = 70
// 自機からどれだけ離れた場所を叩くか。真上は叩かないが、ひびが自機のそばを走るくらいの距離
const STRIKE_MIN_DISTANCE = 60
const STRIKE_MAX_DISTANCE = 160
// 氷のかけらが飛ぶ平均の速さ。遠くへ投げるほど床に届くまでに時間がかかる
const THROW_SPEED = 3.5
// 氷のかけらが床に届くまでの最大フレーム数。最後の氷槌のひびも、沈む前に伸びきるよう抑える
const MAX_THROW_FRAMES = 180
// 周期の開始からひびが沈み始めるまで
const SINK_FRAMES = 500
// ひびを構成する弾の間隔。自機の当たり判定の8倍より狭いので、ひびは抜けられない
const CRACK_SPACING = 16
// ひびが1弾ぶん伸びるのにかかるフレーム数。自機より十分遅く伸びるので、伸びてくる先から逃げられる
const CRACK_FRAMES_PER_STEP = 4
// 叩いた場所から走るひびの本数と、1本あたりの最大の長さ(弾の数)
const CRACK_BRANCHES = 4
const CRACK_LENGTH = 20
// ひびの曲がりやすさ(1弾ごとの向きのぶれ)
const CRACK_WOBBLE = 0.5
// 根元から何弾目でひびが枝分かれするか
const CRACK_FORK_AT = 8

// 師範代が弾を撃ち始めるタイミングと、その回数・間隔。2本目のひびが走っている最中に撃ち始める
const VOLLEY_START = 160
const VOLLEY_COUNT = 4
const VOLLEY_INTERVAL = 75

const HAMMER_COUNT = 4
const HAMMER_LIFE = 600

export default class extends Stage {
    *G() {
        const boss = new EnemyAssistant(this.game)
        this.game.enemies.push(boss)

        for (let i = 0; i < HAMMER_COUNT; i++) {
            this.game.enemies.push(new EnemyHammer(this.game, boss, i))
        }

        yield* this.waitAllEnemiesDead()
    }
}

// ひびの形。centerから数本のひびが曲がりながら走り、途中で一度だけ枝分かれする。
// stepは中心から数えて何弾目か(ひびが伸びる順番)。画面の外へ出たひびはそこで止まる
function crack(center: Vec, width: number, height: number): { p: Vec; step: number }[] {
    const result = [{ p: center, step: 0 }]

    const walk = (p: Vec, radian: number, step: number, length: number) => {
        for (let i = 1; i <= length; i++) {
            radian += (Math.random() - 0.5) * CRACK_WOBBLE
            p = p.add(vec.arg(radian).scale(CRACK_SPACING))

            if (p.x < 0 || width < p.x || p.y < 0 || height < p.y) return

            result.push({ p, step: step + i })

            if (i === CRACK_FORK_AT) {
                const side = Math.random() < 0.5 ? -1 : 1
                walk(p, radian + (side * T) / 8, step + i, Math.floor((length - i) / 2))
            }
        }
    }

    const base = Math.random() * T

    for (let k = 0; k < CRACK_BRANCHES; k++) {
        walk(center, base + (T * k) / CRACK_BRANCHES, 0, CRACK_LENGTH)
    }

    return result
}

class EnemyAssistant extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.4, this.game.HEIGHT * 0.2, 7, 4)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, HAMMER_LIFE * HAMMER_COUNT, 48, { renderer: new EnemyRendererCore() })

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
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 900).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            volley: this.volley(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // ひびで狭くなった床へ、輪と氷柱を同時に撃ち込む。
    // 輪は場所を選ばず降ってくるので、ひびの間で輪の隙間を探しつつ、氷柱から身をかわす
    private *volley() {
        yield* Array(VOLLEY_START)

        for (let k = 0; k < VOLLEY_COUNT; k++) {
            yield* remodel(this)
                .format("donut")
                .color("#bfe9ff")
                .p(this.p.clone())
                .speed(2.4)
                .radian(Math.random() * T)
                .ex(24)
                .fire(this.game.bullets)

            yield* remodel(this)
                .format("arrow")
                .color("#dff6ff")
                .p(this.p.clone())
                .speed(3)
                .aim(this.game.player.p.clone())
                .nway(5, T / 20)
                .fire(this.game.bullets)

            yield* Array(VOLLEY_INTERVAL)
        }
    }
}

class EnemyHammer extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, HAMMER_LIFE, 20)

        this.setParent(parent, () => vec.arg(this.frame / 600 + (T * index) / HAMMER_COUNT).scale(140))

        this.addScript(() => this.cycle(index), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(index: number) {
        yield* GenUtils.all({
            strike: this.strike(index),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自分の番が来たら自機の近くの床へ氷のかけらを投げ、届いたところからひびを走らせる
    private *strike(index: number) {
        yield* Array(index * STRIKE_INTERVAL)

        const width = this.game.WIDTH
        const height = this.game.HEIGHT
        const near = this.game.player.p.add(
            vec
                .arg(Math.random() * T)
                .scale(STRIKE_MIN_DISTANCE + Math.random() * (STRIKE_MAX_DISTANCE - STRIKE_MIN_DISTANCE)),
        )
        // 師範代の周りや画面の端は叩かない
        const center = vec(
            Math.min(Math.max(near.x, width * 0.1), width * 0.9),
            Math.min(Math.max(near.y, height * 0.35), height * 0.9),
        )
        const throwFrames = Math.min(Math.ceil(center.sub(this.p).magnitude() / THROW_SPEED), MAX_THROW_FRAMES)
        // ひびが走り始めてから沈み始めるまで。どの氷槌のひびも同じフレームに沈む
        const sinkAt = SINK_FRAMES - index * STRIKE_INTERVAL - throwFrames

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

        const cracks = crack(center, width, height)

        yield* remodel(this)
            .format("small-ball")
            .color("#8fd8ff")
            .speed(0)
            .duplicate(cracks.length, (b, i) => {
                b.p = cracks[i].p
                b.delay = cracks[i].step * CRACK_FRAMES_PER_STEP
                return b
            })
            .g(function* (me) {
                const appearFrames = 12
                // 自機の真上に突然出現しないよう、大きさ0から現れる(見た目と判定は常に一致)
                yield* Behavior.appear(me, appearFrames)
                yield* Array(Math.max(0, sinkAt - me.delay - appearFrames))

                // 沈み始めた時点で当たり判定は消える
                yield* Behavior.fadeout(me, 30)
            })
            .fire(this.game.bullets)
    }
}
