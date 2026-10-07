import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Comet } from "./Comet"

// ステージ「彗星」(流星道場・高弟)
// 高弟(太陽)のまわりを、尾を引く彗星が細長い楕円を描いて回る。
// 彗星は太陽から遠い画面の下の方ではゆっくり、太陽に近づくほど速くなり、太陽をかすめて反対側へ大きく振れて戻ってくる。
// 彗星は画面の下の方に小さく現れてから動き出すので、どこを通るかはそこで読める。
// 遠くではゆっくりなので、自機のそばを通る彗星はよく見てかわせる。ただし尾が残るので、彗星の通った跡にも気をつける。
// 太陽のまわりを回る2つの惑星(衛星)が、ゆっくりした弾を自機へ投げてくる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ
const CYCLE_FRAMES = 620
// 1周期に放つ彗星の数と間隔
const COMETS = 3
const COMET_INTERVAL = 40
const COMET: Comet.Config = {
    period: 300,
    orbits: 1.4,
    perihelion: 50,
    tailInterval: 3,
    tailLife: 40,
    color: "#bfe8ff",
}

const PLANET_LIFE = 650

export default class extends Stage {
    *G() {
        const sun = new EnemySun(this.game)
        this.game.enemies.push(sun, new EnemyPlanet(this.game, sun, 0), new EnemyPlanet(this.game, sun, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemySun extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, PLANET_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

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

    // 画面の下の方のあちこちに彗星を放つ。回る向きは彗星ごとに変える
    private *cycle() {
        yield* GenUtils.all({
            comets: (function* (me: EnemySun) {
                for (let k = 0; k < COMETS; k++) {
                    const x = me.game.WIDTH * (0.1 + 0.8 * me.random())
                    const y = me.game.HEIGHT * (0.7 + 0.2 * me.random())
                    // 自機の真上には出さない。近すぎたら画面幅の半分だけずらす
                    const aphelion =
                        Math.abs(x - me.game.player.p.x) < 120
                            ? vec((x + me.game.WIDTH / 2) % me.game.WIDTH, y)
                            : vec(x, y)

                    yield* Comet.launch(me, aphelion, k % 2 === 0 ? 1 : -1, COMET).fire(me.game.bullets)
                    yield* Array(COMET_INTERVAL)
                }
            })(this),
            wait: Array(CYCLE_FRAMES),
        })
    }
}

class EnemyPlanet extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, PLANET_LIFE, 24)

        const radius = 110 + 60 * index
        this.setParent(parent, () => vec.arg(this.frame / (150 + 100 * index) + T * 0.5 * index).scale(radius))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + 120 + index * 60, loop: Infinity })
    }

    // ゆっくりした弾を3つ、自機へ投げる
    private *cycle() {
        yield* remodel(this)
            .format("donut")
            .color("#ffe8a0")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player)
            .nway(3, T / 18)
            .g((me) => Behavior.accel(me, 60, 2.6))
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
