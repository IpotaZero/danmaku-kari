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

// ステージ「亀甲」(鉄壁道場・師範代)
// 師範代(ボス)は、弾を蜂の巣のように並べた甲羅にこもっている。甲羅は自機の弾を受け止めるが、撃ち続けると一枚ずつ砕ける。
// 一か所に撃ち込み続けて穴を開ければ、そこから師範代に弾が届く。
// しばらくすると甲羅は弾け飛び、砕け残った甲羅の破片がすべて外へ向かって飛んでくる。たくさん砕いておくほど破片は少ない。
// 弾け飛ぶ前には甲羅が明滅するので、それが提示になる。弾け飛んだ後、新しい甲羅をまとい直す。
// 甲羅の外を回る2匹の子亀(衛星)が、ゆっくりした弾を自機へ投げてくる。

const ENTRANCE_FRAMES = 150
// 甲羅。40フレームでまとい、460フレームこもり、50フレーム明滅してから弾け飛ぶ
const SHELL: Shield.ShellConfig = {
    spacing: 22,
    inner: 46,
    outer: 118,
    durability: 10,
    spin: T / 900,
    form: 40,
    hold: 460,
    warn: 50,
    shardSpeed: 2.6,
}
// 1周期の長さ。破片が飛び去った後、2秒ほど休憩が入る
const CYCLE_FRAMES = SHELL.form + SHELL.hold + SHELL.warn + 180

const TURTLE_LIFE = 600

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyTurtle(this.game, master, 0), new EnemyTurtle(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.05, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, TURTLE_LIFE * 2, 36, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.22)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 2000).add(this.home())
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            shell: this.shell(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    private *shell() {
        yield* Shield.shell(this, SHELL, this.random() * T).fire(this.game.bullets)
    }
}

class EnemyTurtle extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, TURTLE_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 150 + (T / 2) * index).scale(170))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 90 + index * 55, loop: Infinity })
    }

    // ゆっくりした弾を3つ、自機へ投げる
    private *cycle() {
        yield* remodel(this)
            .format("donut")
            .color("#a8e8b0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(3, T / 18)
            .g((me) => Behavior.accel(me, 60, 2.6))
            .fire(this.game.bullets)

        yield* Array(110)
    }
}
