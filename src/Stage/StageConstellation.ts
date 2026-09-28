import { vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { Remodel, remodel } from "../Game/Remodel"
import { Stage } from "./Stage"
import { EnemyRendererCore } from "../Game/Actor/EnemyRendererCore"
import { T } from "../T"
import { GenUtils } from "../utils/Functions/GeneratorUtils"
import { Curves } from "../utils/Functions/Curves"

// ステージ「星座」
// 月(ボス)の周りを5つの星(衛星)がゆっくり公転し、星どうしが弾で線を引いて五芒星を描く。
// 描かれた線は一斉に左右へ割れ、2枚の壁となって画面を掃いていく。
// 星を落とせばその星から伸びる線が消えるため、「どの星から撃つか」がそのまま攻略になる。
// 公転によって五芒星は毎回少しずつ回転しており、壁の来る方向が周期ごとに変わる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。月と星は互いを参照せず、同じ周期で回ることで同期する
const CYCLE_FRAMES = 330
// 線を引き終えるまでのフレーム数(弾幕の提示)
const DRAW_FRAMES = 40
// 周期の開始から線が割れて飛び出すまでのフレーム数
const LAUNCH_FRAMES = 120
// 線を構成する弾の間隔。割れた後の壁の隙間はこの2倍になる
const STAR_SPACING = 24

const STAR_COUNT = 5
const STAR_LIFE = 300

export default class extends Stage {
    *G() {
        const moon = new EnemyMoon(this.game)
        this.game.enemies.push(moon)

        const stars = Array.from({ length: STAR_COUNT }, (_, i) => new EnemyStar(this.game, moon, i))
        // 一つ飛ばしに結ぶことで五芒星になる
        stars.forEach((star, i) => star.link(stars[(i + 2) % STAR_COUNT]))

        const stars2 = Array.from({ length: STAR_COUNT }, (_, i) => new EnemyStar2(this.game, moon, i))

        this.game.enemies.push(...stars)
        this.game.enemies.push(...stars2)

        yield* this.waitAllEnemiesDead()
        this.shake(16, 60)
        this.flash("#ffffff", 12)
        this.scorenizeAllBullets()
    }
}

class EnemyMoon extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.15, this.game.HEIGHT * 0.08, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, STAR_LIFE * STAR_COUNT, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.38)
    }

    // 星座の中心なのでごくゆっくりとしか動かない
    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1800).add(this.home())
        yield
    }

    // 壁が割れた直後と、壁が画面を抜けたころの2回、ゆっくりした輪を放つ。
    // 壁の隙間を探している最中に輪が重なり、集中を乱す役目
    private *attack() {
        yield* GenUtils.all({
            attack: (function* (me: EnemyMoon) {
                yield* Array(LAUNCH_FRAMES + 10)
                yield* me.ring(0)
                yield* Array(70)
                yield* me.ring(0.5)
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *ring(offset: number) {
        const count = 18

        yield* remodel(this)
            .colorful(this.frame)
            .appearance("donut")
            .p(this.p.clone())
            .r(12)
            .speed(1.6)
            .radian((T / count) * offset + this.frame * 0.01)
            .ex(count)
            .fire(this.game.bullets)
    }
}

class EnemyStar extends Enemy {
    constructor(game: Game, moon: Enemy, index: number) {
        super(game, STAR_LIFE, 20)

        const phase = (T * index) / STAR_COUNT - T / 4
        const orbitSpeed = T / 4800
        const radius = 360

        this.setParent(moon, () => vec.arg(phase + this.frame * orbitSpeed).scale(radius))
    }

    // 結ぶ相手の星を決めて周期を開始する。相手はプロパティに持たずジェネレータに閉じ込める
    link(partner: Enemy) {
        this.addScript(() => this.cycle(partner), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle(partner: Enemy) {
        yield* GenUtils.all({
            weave: this.weave(partner),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 自分から相手へ弾を並べて線を引き、LAUNCH_FRAMESで一斉に左右へ割る
    private *weave(partner: Enemy) {
        if (this.life <= 0 || partner.life <= 0) return

        const start = this.p.clone()
        const diff = partner.p.clone().sub(start)
        const num = Math.max(2, Math.floor(diff.magnitude() / STAR_SPACING))
        const normal = diff.radian() + T / 4

        yield* remodel(this)
            .colorful(this.frame)
            .appearance("ball")
            .r(4)
            .speed(0)
            .duplicate(num, (b, i) => {
                b.p = start.add(diff.scale(i / (num - 1)))
                // 交互に反対側へ飛ばし、1本の線を2枚の壁に割る
                b.radian = normal + (i % 2) * (T / 2)
                b.delay = Math.floor((i * DRAW_FRAMES) / num)
                return b
            })
            .g(function* (me) {
                const appearFrames = 16
                // 自機の真上に突然出現しないよう、大きさ0から現れる(見た目と判定は常に一致)
                yield* Remodel.appear(me, appearFrames)
                yield* Array(LAUNCH_FRAMES - me.delay - appearFrames)
                yield* Remodel.accel(me, 60, 6)
            })
            .fire(this.game.bullets)
    }
}

class EnemyStar2 extends Enemy {
    constructor(game: Game, moon: Enemy, index: number) {
        super(game, STAR_LIFE, 20)

        this.setParent(moon, () => vec.arg((T * index) / STAR_COUNT + ((T / 4) * this.frame) / 360).scale(120))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    private *cycle() {
        yield* GenUtils.all({
            weave: this.snipe(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 壁が割れた少し後、各星から一発ずつ自機狙い。5方向から来るので壁の隙間で待つだけでは済まない
    private *snipe() {
        yield* Array(LAUNCH_FRAMES + 40)
        if (this.life <= 0) return

        yield* remodel(this)
            .colorful(this.frame)
            .appearance("arrow")
            .collision("arrow")
            .p(this.p.clone())
            .r(24)
            .ex(5)
            .speed(3.5)
            .g(function* (me) {
                yield* Remodel.stop(me, 60)
                yield* Remodel.ease(me, "radian", me.game.player.p.sub(me.p).radian(), 30)
                yield* Remodel.accel(me, 60, 12)
            })
            .fire(this.game.bullets)
    }
}
