import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Lightning } from "./Lightning"

// ステージ「青龍」(四天王)
// 青龍の頭のうしろに、十二節の胴が連なって空をうねる。胴は頭の通った道筋をそのままたどる。
// 胴は、しっぽの一節にしか攻撃が効かない(ほかの節の体力の帯は赤い)。しっぽの節を落とすと、その一つ前が新しいしっぽになる。
// 胴をすべて落とすと、ようやく頭に攻撃が効くようになる。動き回るしっぽを追いかけて撃つ。
// 胴の節はときどき鱗を落とし、頭は稲妻を落とす。稲妻の通り道は、落ちる前にぎざぎざの薄い線で見える。
// 胴が短くなるほど、空は荒れていく。
//   胴が九節以上: ときどき稲妻が一本落ちる。
//   五〜八節: 稲妻が二本ずつ落ちる。
//   一〜四節: 雷雨。稲妻が三本ずつ、休みなく落ちる。
//   頭だけ: 昇龍。頭から四方へ稲妻がほとばしる。

const SEGMENTS = 12
const SEGMENT_LIFE = 170
const HEAD_LIFE = 2200
// 胴の節と節の間隔(頭が何フレーム前にいた所をたどるか)
const LAG = 20
// 頭がうねる道筋の一周にかかるフレーム数
const PERIOD = 1000
const ENTRANCE_FRAMES = 150

const BOLT: Lightning.Config = { preview: 50, strike: 26 }
const SCALE: Color = "#7ad0ff"

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["空が……ごろごろ鳴ってる。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["よくぞ全ての道場を巡った。我は四天王が一、東の青龍。"], { name: "青龍" })
        yield* this.game.textBox.say(["我が尾を捕らえてみよ。捕らえられればの話だがな。"], { name: "青龍" })
        this.hideFigure("hachinoko")

        const head = new EnemyDragonHead(this.game)
        const body = Array.from({ length: SEGMENTS }, (_, i) => new EnemySegment(this.game, head, i))
        head.body = body

        this.game.enemies.push(...body.toReversed(), head)

        // しっぽの節にだけ攻撃が効くようにする。胴がなくなったら頭に効くようにする
        while (head.life > 0) {
            const alive = body.filter((s) => s.life > 0)
            const tail = alive[alive.length - 1]

            alive.forEach((s) => {
                s.isInvincible = s !== tail
            })
            head.isInvincible = tail !== undefined || head.frame < ENTRANCE_FRAMES

            yield
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……見事。我が尾も頭も、捕らえられたか。"], { name: "青龍" })
        yield* this.game.textBox.say(["しっぽを追いかけるの、大変だったよ。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["南へ進め。朱雀が待っている。"], { name: "青龍" })
        this.hideFigure("hachinoko")
    }
}

class EnemyDragonHead extends Enemy {
    // 頭が通った道筋。胴の節はこれをたどる
    readonly trail: Vec[] = []
    body: readonly EnemySegment[] = []

    constructor(game: Game) {
        super(game, HEAD_LIFE, 46, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = this.course(0).add(vec(0, -300))

        this.addScript(() => this.enter())
    }

    // 頭がうねる道筋。画面の上半分に、横長の八の字を描く
    private course(t: number) {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        const a = (T * t) / PERIOD
        return vec(w / 2 + w * 0.36 * Math.sin(a), h * 0.3 + h * 0.15 * Math.sin(2 * a))
    }

    // 頭が f フレーム前にいた所。それより前は、登場のときの位置
    at(f: number) {
        return this.trail[Math.max(0, this.trail.length - 1 - f)] ?? this.p
    }

    private *enter() {
        const from = this.p.clone()

        for (let f = 1; f <= ENTRANCE_FRAMES; f++) {
            this.p = from.add(
                this.course(0)
                    .sub(from)
                    .scale(f / ENTRANCE_FRAMES),
            )
            this.trail.push(this.p.clone())
            yield
        }

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.storm(), { loop: Infinity })
    }

    private *move() {
        this.p = this.course(this.frame - ENTRANCE_FRAMES)
        this.trail.push(this.p.clone())
        // 一番うしろの節がたどる所より前は要らない
        if (this.trail.length > (SEGMENTS + 2) * LAG) this.trail.shift()
        yield
    }

    private remaining() {
        return this.body.filter((s) => s.life > 0).length
    }

    // 頭から、自機のあたりへ向かって稲妻を count 本、少しずつずらして落とす
    private *bolts(count: number) {
        for (let k = 0; k < count; k++) {
            const target = this.game.player.p.add(vec((this.random() - 0.5) * 220, 0))
            const direction = Lightning.toward(this.p, target, 0.25, () => this.random())

            yield* Lightning.bolt(this, this.p.clone(), direction, 34, BOLT).fire(this.game.bullets)
            yield* Array(14)
        }
    }

    // 胴の長さに合わせて、空の荒れ方を変える
    private *storm() {
        const left = this.remaining()

        if (left >= 9) {
            yield* Array(200)
            yield* this.bolts(1)
        } else if (left >= 5) {
            yield* Array(150)
            yield* this.bolts(2)
        } else if (left >= 1) {
            yield* Array(110)
            yield* this.bolts(3)
        } else {
            yield* this.rising()
        }
    }

    // 昇龍。頭から四方八方へ稲妻をほとばしらせ、その合間に輪を放つ
    private *rising() {
        yield* Array(90)

        const base = this.random() * T
        for (let k = 0; k < 6; k++) {
            yield* Lightning.bolt(this, this.p.clone(), base + (T * k) / 6, 30, BOLT).fire(this.game.bullets)
        }

        yield* Array(BOLT.preview + 20)

        yield* remodel(this)
            .format("donut")
            .color(SCALE)
            .p(this.p.clone())
            .speed(1.6)
            .radian(base + T / 12)
            .ex(24)
            .fire(this.game.bullets)

        yield* Array(80)
    }
}

class EnemySegment extends Enemy {
    constructor(game: Game, head: EnemyDragonHead, index: number) {
        super(game, SEGMENT_LIFE, 22, { renderer: new EnemyRendererCore() })
        this.isInvincible = true
        this.p = head.p.clone()

        this.addScript(
            function* (me) {
                if (head.life <= 0) me.life = 0
                me.p = head.at((index + 1) * LAG)
                yield
            },
            { loop: Infinity },
        )

        // 節ごとに少しずつずらして、鱗を落とす
        this.addScript(() => this.scales(), { loop: Infinity, margin: ENTRANCE_FRAMES + 40 + index * 23 })
    }

    // 鱗。二枚ずつ、はらはらと落ちていく
    private *scales() {
        yield* remodel(this)
            .format("diamond")
            .r(12)
            .color(SCALE)
            .p(this.p.clone())
            .speed(0.6)
            .radian(T / 4)
            .nway(2, T / 8)
            .g(function* (me) {
                const base = me.radian
                yield* GenUtils.all({
                    fall: Behavior.accel(me, 90, 2.4),
                    sway: (function* () {
                        for (let f = 0; ; f++) {
                            me.radian = base + 0.4 * Math.sin(f / 20)
                            yield
                        }
                    })(),
                })
            })
            .fire(this.game.bullets)

        yield* Array(SEGMENTS * 23)
    }
}
