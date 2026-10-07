import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Wildfire } from "./Wildfire"

// ステージ「朱雀」(四天王)
// 画面の下の方に草むらが生え、朱雀が火種を落とす。火は草から草へ燃え広がり、草のない地面には燃え移らない。
// 草の生え方と火種は燃え広がる前に見えるので、火の来ない地面を探して立つ。燃え上がった草はときどき火の粉を飛ばす。
// 朱雀は不死鳥。二度倒しても炎の中から蘇り、そのたびに体力は満ちて、野の様子が変わる。三度目でようやく倒れる。
// 一度目: 野火。ところどころに丸く草むらがある。
// 二度目: 焼け野。草が斜めの帯になって生えていて、火は帯に沿って走る。帯の間の地面を歩く。
// 三度目: 劫火。草むらは迷路になっていて、道(地面)は一ます幅しかない。迷路の壁が燃え上がる中、道の上で火の粉をかわす。

const LIFE = 1800
const REBIRTHS = 2
const ENTRANCE_FRAMES = 150
// 蘇っている間(攻撃が効かない)
const REBIRTH_FRAMES = 150
// 草むらを敷く範囲の上端(画面の高さの割合)
const FIELD_TOP = 0.34
const FEATHER: Color = "#ffb070"

const FIRES: Wildfire.Config[] = [
    { grow: 40, kindle: 60, step: 6, burn: 40, ember: 0.08, emberSpeed: 1.3 },
    { grow: 40, kindle: 60, step: 4, burn: 50, ember: 0.06, emberSpeed: 1.3 },
    { grow: 50, kindle: 70, step: 5, burn: 45, ember: 0.04, emberSpeed: 1.0 },
]
// 燃え尽きてからの休憩
const REST_FRAMES = 140

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["あったかい……というか、熱い!"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["四天王が二、南の朱雀。野を焼き、灰より蘇る者。"], { name: "朱雀" })
        yield* this.game.textBox.say(["我を討つなら、三度討て。"], { name: "朱雀" })
        this.hideFigure("hachinoko")

        this.game.enemies.push(new EnemySuzaku(this.game))
        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)

        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["三度も討たれるとは。灰に還るとしよう。"], { name: "朱雀" })
        yield* this.game.textBox.say(["もう生き返らないよね……?"], { name: "ハチノコ" })
        yield* this.game.textBox.say(["さてな。西へ行け。白虎の爪は鋭いぞ。"], { name: "朱雀" })
        this.hideFigure("hachinoko")
    }
}

class EnemySuzaku extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        super(game, LIFE, 60, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.addScript(() => this.enter())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)
        this.isInvincible = false

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.immortal())
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 倒されても REBIRTHS 回までは蘇る。蘇るたびに野の様子(段)が変わる
    private *immortal() {
        const lives = [() => this.wildfire(), () => this.scorched(), () => this.inferno()]

        this.addScript(lives[0], { loop: Infinity, id: "cycle" })

        for (let k = 1; k <= REBIRTHS; k++) {
            // 体力が尽きたフレームのうちに満たし直すので、倒れずに済む
            while (this.life > 0) yield

            this.life = this.maxLife
            this.isInvincible = true
            this.removeScript("cycle")
            yield* this.rebirth()
            this.isInvincible = false

            this.addScript(lives[k], { loop: Infinity, id: "cycle" })
        }
    }

    // 蘇る。火の粉を撒き散らして、画面じゅうの弾を灰(スコア)に変える
    private *rebirth() {
        this.game.camera.shake(10, 40)
        this.game.bullets.filter((b) => b.type === "enemy" || b.type === "neutral").forEach((b) => b.scorenize())

        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .format("small-ball")
                .r(5)
                .type("effect")
                .isScorable(false)
                .color(k % 2 === 0 ? "#ffd070" : "#ff7040")
                .p(this.p.clone())
                .speed(3 + k)
                .radian(this.random() * T)
                .ex(36)
                .g(function* (me) {
                    yield* Behavior.ease(me, "alpha", 0, 50)
                    me.life = 0
                })
                .fire(this.game.bullets)
            yield* Array(15)
        }

        yield* Array(REBIRTH_FRAMES - 45)
    }

    // 草むらの中から、count 個の火種のます目を選ぶ。near を渡すと、一つ目はそのそばの草にする
    private ignitions(field: Wildfire.Field, layout: Wildfire.Layout, count: number, near: boolean) {
        const grass: [number, number][] = []
        for (let r = 0; r < field.rows; r++) {
            for (let c = 0; c < field.columns; c++) {
                if (layout(r, c)) grass.push([r, c])
            }
        }
        if (grass.length === 0) return []

        const result: [number, number][] = []

        if (near) {
            const player = this.game.player.p
            const close = grass.filter(([r, c]) => field.position(r, c).sub(player).magnitude() < 180)
            if (close.length > 0) result.push(close[Math.floor(this.random() * close.length)])
        }

        while (result.length < count) result.push(grass[Math.floor(this.random() * grass.length)])
        return result
    }

    private *burn(
        layout: Wildfire.Layout,
        field: Wildfire.Field,
        ignitions: [number, number][],
        config: Wildfire.Config,
    ) {
        yield* field.burn(layout, ignitions, config).fire(this.game.bullets)
    }

    // 羽根。ゆっくり扇形に広がって、自機の方へ舞い落ちる
    private *feathers(way: number) {
        yield* remodel(this)
            .format("wedge")
            .color(FEATHER)
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(way, T / 22)
            .g((me) => Behavior.accel(me, 60, 3))
            .fire(this.game.bullets)
    }

    private *featherEvery(interval: number, count: number, way: number) {
        for (let k = 0; k < count; k++) {
            yield* Array(interval)
            yield* this.feathers(way)
        }
    }

    // 一度目。丸い草むらに、火種を四つ(一つは自機のそば)
    private *wildfire() {
        const config = FIRES[0]
        const field = new Wildfire.Field(this, FIELD_TOP)
        const layout = field.patches(0.5)

        yield* this.burn(layout, field, this.ignitions(field, layout, 4, true), config)
        yield* this.during(field.duration(config), this.featherEvery(100, 4, 5))
        yield* Array(REST_FRAMES)
    }

    // 二度目。斜めの帯の草むらに、火種を三つ
    private *scorched() {
        const config = FIRES[1]
        const field = new Wildfire.Field(this, FIELD_TOP)
        const layout = field.stripes((this.random() - 0.5) * 1.2, 3, 2)

        yield* this.burn(layout, field, this.ignitions(field, layout, 3, true), config)
        yield* this.during(field.duration(config), this.ringEvery(120, 3))
        yield* Array(REST_FRAMES)
    }

    // 三度目。迷路の草むらに、火種を四つ
    private *inferno() {
        const config = FIRES[2]
        const field = new Wildfire.Field(this, FIELD_TOP)
        const layout = field.maze()

        yield* this.burn(layout, field, this.ignitions(field, layout, 4, false), config)
        yield* this.during(field.duration(config), this.featherEvery(130, 3, 3))
        yield* Array(REST_FRAMES)
    }

    // frames の間、attack を撃ち続ける(攻撃が早く終わっても frames までは待つ)
    private *during(frames: number, attack: Generator<void, void, void>) {
        for (let f = 0; f < frames; f++) {
            attack.next()
            yield
        }
    }

    private *ringEvery(interval: number, count: number) {
        for (let k = 0; k < count; k++) {
            yield* Array(interval)
            yield* remodel(this)
                .format("donut")
                .color(FEATHER)
                .p(this.p.clone())
                .speed(1.6)
                .radian(this.random() * T)
                .ex(20)
                .fire(this.game.bullets)
        }
    }
}
