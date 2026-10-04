import { Vec, vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Wind } from "../Gale/Wind"
import { SpiderWeb } from "../Web/SpiderWeb"
import { Mist } from "../Mist/Mist"
import { Sand } from "../Sand/Sand"
import { Mirage } from "../Haze/Mirage"
import { Heat } from "../Haze/Heat"
import { Shield } from "../Iron/Shield"
import { Meteor } from "../Meteor/Meteor"
import { Comet } from "../Meteor/Comet"
import { Shadow } from "../Moon/Shadow"
import { Phase } from "../Moon/Phase"
import { Sting } from "./Sting"

// ステージ「チャンピオン」
// すべての道場の頂に立つチャンピオンは、各道場の技を次々に繰り出す。体力が一定の量だけ減るごとに、次の技へ移る。
// 疾風(突風に流される雨)→網掛(画面を覆う巣)→霧隠(飛び石)→砂塵(吸い込みながらの砂嵐)→陽炎(鏡に映る熱の柱)
// →鉄壁(盾の輪と城壁)→流星(流星群と彗星)→月影(影に追われる満ち欠け)と進み、
// 最後に自分の技を見せる。毒針: 予告線に沿って針の列が飛ぶ。包囲網: 自機を囲んだ輪が縮み、二つの抜け道から逃げる。

const ENTRANCE_FRAMES = 150
// 段の数と、一段あたりの体力
const PHASES = 9
const LIFE_PER_PHASE = 1200
const LIFE = PHASES * LIFE_PER_PHASE

const RAIN: Wind.Rain = { gap: 64, frames: 260, interval: 5, speed: 4.5 }
const WIND: Wind.Shape = { angle: T / 9, rise: 20, hold: 40, fall: 20 }

const WEB: SpiderWeb.Config = {
    spokes: 12,
    rings: 16,
    ringGap: 64,
    spacing: 14,
    flightFrames: 90,
    landFrames: 45,
    solidFrames: 300,
}

const CLOCK = new Mist.Clock(140, 30)
const FIELD: Mist.Field = { spacing: 46, top: 0.36, intro: 70, active: CLOCK.period * 3, fade: 30 }
const STONE_COLORS: Color[] = ["#f0f0ff", "#8080a0"]

const BAND: Sand.Band = {
    rows: 7,
    rowGap: 44,
    speed: 1.4,
    spacing: 10,
    segment: [80, 150],
    gap: [80, 120],
    flow: [1, 2.4],
}

const RING: Shield.RingConfig = { radius: 100, slots: 32, windowSlots: 4, spin: T / 600 }
const WALL: Shield.WallConfig = { spacing: 14, window: 64, build: 60, speed: 1.5 }

const METEOR: Meteor.Config = { preview: 60, speed: 10, tailInterval: 2, tailLife: 50, color: "#fff4b0" }
const COMET: Comet.Config = {
    period: 300,
    orbits: 1.4,
    perihelion: 50,
    tailInterval: 3,
    tailLife: 40,
    color: "#bfe8ff",
}

const SHADOW: Shadow.Config = { delay: 50, stepInterval: 6, stepLife: 120, frames: 300, color: "#b8a8ff" }
const MOON: Phase.Ring = { count: 40, speed: 2, color: "#fff2c0" }

const NEEDLE: Sting.Needle = { preview: 40, count: 6, interval: 3, speed: 11 }
const SWARM: Sting.Swarm = { count: 44, gap: 4, from: 250, to: 50, preview: 50, shrink: 160 }

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["ここが、てっぺん……。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["よく来た、小さな蜂の子。わたしがチャンピオンのスズメバチだ。"], {
            name: "スズメバチ",
        })
        yield* this.game.textBox.say(["道場を巡ってきたのだろう? では、その全てをもう一度見せてもらおう。"], {
            name: "スズメバチ",
        })
        yield* this.game.textBox.say(["……全部!?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["そして最後に、わたしの針を。"], { name: "スズメバチ" })
        this.hideFigure("hachinoko")

        const boss = new EnemyChampion(this.game)
        this.game.enemies.push(boss)

        const phase = boss.start()
        phase.next()

        for (let k = 1; k < PHASES; k++) {
            while (boss.life > LIFE - k * LIFE_PER_PHASE) yield

            phase.next()
            this.scorenizeAllBullets()
            this.shake(6, 20)
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["……見事。わたしの針も、もう届かないか。"], { name: "スズメバチ" })
        yield* this.game.textBox.say(["どの道場の技も、ちゃんと覚えてたから。"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["それが強さだ。今日からお前がチャンピオンだよ。"], { name: "スズメバチ" })
        this.hideFigure("hachinoko")
        this.showFigure("hachinoko", "assets/figure/Hachinoko-smile.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["やったずぇ!"], { name: "ハチノコ" })
        this.hideFigure("hachinoko")
    }
}

class EnemyChampion extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)
    private readonly ring = new Shield.Ring(this, RING, this.random() * T)

    constructor(game: Game) {
        super(game, LIFE, 60, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    *start() {
        yield* this.next(() => this.gale(), ENTRANCE_FRAMES)
        yield* this.next(() => this.web(), 120)
        yield* this.next(() => this.mist(), 120)
        yield* this.next(() => this.sand(), 120)

        const mirrors = [Mirage.horizontal(this.game)]
        this.addScript(() => Mirage.lines(this, mirrors), { id: "mirror-lines" })
        this.addScript(() => Mirage.ghosts(this, mirrors), { id: "mirror-ghosts" })
        yield* this.next(() => this.haze(), 120)
        this.removeScript("mirror-lines")
        this.removeScript("mirror-ghosts")

        // 盾の輪は段が変わるときにスコアに変わって消える
        this.addScript(() => this.ring.build().fire(this.game.bullets), { margin: 30 })
        yield* this.next(() => this.iron(), 120)

        yield* this.next(() => this.meteor(), 120)
        yield* this.next(() => this.moon(), 120)
        yield* this.next(() => this.sting(), 120)
    }

    // 技を cycle に差し替え、margin フレーム後からくり返させる。次の段へ進むまで待つ
    private *next(cycle: () => Generator<void, void, void>, margin: number) {
        this.addScript(cycle, { loop: Infinity, id: "cycle", margin })
        yield
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)
        this.isInvincible = false

        this.addScript(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.16)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    private *arrows(way: number) {
        yield* remodel(this)
            .format("arrow")
            .color("#ffe8a0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(way, T / 24)
            .g((me) => Behavior.accel(me, 50, 3.4))
            .fire(this.game.bullets)
    }

    // 疾風: 三度の突風に流される雨
    private *gale() {
        const forecast = new Wind.Forecast(
            [80, 200, 320].map((start) => ({ start, direction: this.random() < 0.5 ? -1 : 1 })),
            WIND,
        )

        yield* GenUtils.all({
            rain: forecast
                .rain(remodel(this), this.game, RAIN, this.random() * RAIN.gap)
                .format("diamond")
                .color("#9dffc8")
                .fire(this.game.bullets),
            streaks: forecast.streaks(remodel(this), this.game, this.random).fire(this.game.bullets),
            wait: Array(700),
        })
    }

    // 網掛: 画面を覆う巣を編み、網目の中へ矢を射かける
    private *web() {
        const w = this.game.WIDTH
        const h = this.game.HEIGHT
        const center = vec(w * (0.3 + 0.4 * this.random()), h * (0.45 + 0.25 * this.random()))

        yield* GenUtils.all({
            web: SpiderWeb.weave(remodel(this), WEB, this.game, center, this.random() * T)
                .color("#f4f0ff")
                .fire(this.game.bullets),
            arrows: (function* (me: EnemyChampion) {
                yield* Array(WEB.flightFrames + WEB.landFrames + 20)

                for (let k = 0; k < 4; k++) {
                    yield* me.arrows(5)
                    yield* Array(70)
                }
            })(this),
            wait: Array(WEB.flightFrames + WEB.landFrames + WEB.solidFrames + 200),
        })
    }

    // 霧隠: 交互に霧になる市松模様の石の上を飛び移る
    private *mist() {
        yield* GenUtils.all({
            stones: Mist.stones(
                remodel(this),
                this.game,
                CLOCK,
                FIELD,
                vec(this.random(), this.random()).scale(FIELD.spacing),
                STONE_COLORS,
            ).fire(this.game.bullets),
            arrows: (function* (me: EnemyChampion) {
                yield* Array(FIELD.intro)

                for (let t = 0; t < FIELD.active - 70; t += 70) {
                    yield* me.arrows(3)
                    yield* Array(70)
                }
            })(this),
            wait: Array(FIELD.intro + FIELD.active + FIELD.fade + 180),
        })
    }

    // 砂塵: 吸い寄せられながら砂嵐の帯をくぐる
    private *sand() {
        const travel = Sand.travelFrames(this, BAND)

        yield* GenUtils.all({
            storm: Sand.storm(this, BAND),
            swirl: Sand.swirl(this, travel).fire(this.game.bullets),
            suction: Sand.suction(this, 0.6, travel),
            wait: Array(travel + 150),
        })
    }

    // 陽炎: 真ん中の鏡に映った熱の柱が、上下から伸びる
    private *haze() {
        const mirrors = [Mirage.horizontal(this.game)]

        yield* GenUtils.all({
            plumes: Heat.plumes(this, 3, mirrors),
            arrows: (function* (me: EnemyChampion) {
                yield* Array(Heat.SEED_FRAMES + 60)

                for (let k = 0; k < 3; k++) {
                    yield* remodel(me)
                        .format("arrow")
                        .color("#ffe0b0")
                        .p(me.p.clone())
                        .speed(0.5)
                        .aim(me.game.player.p)
                        .nway(3, T / 24)
                        .g((b) => Behavior.accel(b, 50, 3.4))
                        .mirrorAll(mirrors)
                        .fire(me.game.bullets)
                    yield* Array(50)
                }
            })(this),
            wait: Array(Heat.PLUME_TOTAL_FRAMES + 300),
        })
    }

    // 鉄壁: 盾の輪の窓と城壁の窓がそろったときだけ撃ち込める
    private *iron() {
        yield* GenUtils.all({
            walls: (function* (me: EnemyChampion) {
                for (let k = 0; k < 2; k++) {
                    const width = me.game.WIDTH
                    const windows = [0, 1].map((j) => (width * (j + 0.15 + 0.7 * me.random())) / 2)
                    yield* Shield.wall(me, me.game.HEIGHT * 0.3, windows, WALL).fire(me.game.bullets)
                    yield* Array(230)
                }
            })(this),
            stream: (function* (me: EnemyChampion) {
                yield* Array(200)

                for (let f = 0; f < 90; f += 5) {
                    const angle = me.ring.angle()

                    yield* remodel(me)
                        .format("diamond")
                        .color("#9ab8ff")
                        .speed(3.5)
                        .duplicate(2, (b, k) => {
                            b.p = me.ring.window(k)
                            b.radian = angle + (k * T) / 2
                            return b
                        })
                        .nway(3, T / 40)
                        .fire(me.game.bullets)

                    yield* Array(5)
                }
            })(this),
            wait: Array(860),
        })
    }

    // 流星: 流星群が降る中を彗星が回る
    private *meteor() {
        yield* GenUtils.all({
            comets: (function* (me: EnemyChampion) {
                for (let k = 0; k < 2; k++) {
                    const x = me.game.WIDTH * (0.1 + 0.8 * me.random())
                    const y = me.game.HEIGHT * (0.7 + 0.2 * me.random())
                    const aphelion =
                        Math.abs(x - me.game.player.p.x) < 120
                            ? vec((x + me.game.WIDTH / 2) % me.game.WIDTH, y)
                            : vec(x, y)

                    yield* Comet.launch(me, aphelion, k % 2 === 0 ? 1 : -1, COMET).fire(me.game.bullets)
                    yield* Array(40)
                }
            })(this),
            shower: this.shower(120),
            wait: Array(680),
        })
    }

    // 斜めの向きを決め、平行な線の一部に予告線を引いて流れ星を流す
    private *shower(wait: number) {
        yield* Array(wait)

        const angle = T / 4 + (this.random() < 0.5 ? -1 : 1) * (T / 14 + (this.random() * T) / 14)
        const center = vec(this.game.WIDTH / 2, this.game.HEIGHT / 2)
        const normal = vec.arg(angle + T / 4)
        const reach = (this.game.WIDTH + this.game.HEIGHT) / 2
        const offset = this.random() * 70

        const lanes: Vec[] = Array.from({ length: Math.ceil((reach * 2) / 70) }, (_, k) =>
            center.add(normal.scale(-reach + offset + k * 70)),
        ).filter(() => this.random() < 0.6)

        yield* GenUtils.all(
            Object.fromEntries(
                lanes.map((through, k) => [
                    `lane${k}`,
                    (function* (me: EnemyChampion) {
                        yield* Array(Math.floor(me.random() * lanes.length) * 10)
                        yield* Meteor.fall(me, through, angle, METEOR)
                    })(this),
                ]),
            ),
        )
    }

    // 月影: 影に追われながら、満ち欠けする輪をくぐる
    private *moon() {
        yield* GenUtils.all({
            shadow: Shadow.follow(this, SHADOW),
            phases: (function* (me: EnemyChampion) {
                yield* Array(60)

                const light = me.random() * T
                const turn = me.random() < 0.5 ? -1 : 1

                for (let k = 0; k < 7; k++) {
                    const lit = Math.sin((Math.PI * (k + 1)) / 8)
                    yield* Phase.ring(me, MOON, light + (turn * k * T) / 12, lit).fire(me.game.bullets)
                    yield* Array(36)
                }
            })(this),
            wait: Array(SHADOW.frames + SHADOW.stepLife + 140),
        })
    }

    // 毒針と包囲網。自機を輪で囲み、縮む輪の中へ針を撃ち込む
    private *sting() {
        const center = vec(
            Math.min(Math.max(this.game.player.p.x, 80), this.game.WIDTH - 80),
            Math.min(Math.max(this.game.player.p.y, this.game.HEIGHT * 0.45), this.game.HEIGHT - 80),
        )

        yield* GenUtils.all({
            swarm: Sting.swarm(this, center, SWARM).fire(this.game.bullets),
            needles: (function* (me: EnemyChampion) {
                yield* Array(SWARM.preview)

                for (let k = 0; k < 4; k++) {
                    yield* Sting.needle(me, me.game.player.p.clone(), NEEDLE)
                    yield* Array(10)
                }
            })(this),
            wait: Array(SWARM.preview + SWARM.shrink + 200),
        })
    }
}
