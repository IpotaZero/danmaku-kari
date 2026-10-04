import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { Mirage } from "../Haze/Mirage"

// ステージ「万華鏡」(修行場)
// 画面の上の方に万華鏡の中心があり、修行相手はそのまわりをゆっくり回っている。まわりには六つに映った幻が並ぶ。
// 修行相手の撃つ弾はすべて六つに映り、さらに縦の鏡にも映って、十二枚の花びらのような模様になる。
// 一つ一つの弾の動きは単純なので、自分に近い花びらだけを見て避ける。
// 幻からの矢は、自機を中心のまわりに回した場所を狙う。中心の真下にいると、幻の矢が自分のそばに集まってくる。

const ENTRANCE_FRAMES = 150
// 万華鏡の中心の高さと、修行相手が回る半径
const CENTER_Y = 0.32
const ORBIT = 140
// 映す数
const FOLD = 6
// 1周期の長さ
const CYCLE_FRAMES = 520
const COLORS: Color[] = ["#ffb0e0", "#b0e0ff", "#e0ffb0"]

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyKaleidoscope(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyKaleidoscope extends Enemy {
    private readonly center = vec(this.game.WIDTH / 2, this.game.HEIGHT * CENTER_Y)

    constructor(game: Game) {
        super(game, 3200, 40, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.at(0), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() =>
            Mirage.images(this, (p) =>
                Array.from({ length: FOLD - 1 }, (_, k) =>
                    this.center.add(p.sub(this.center).rotate((T * (k + 1)) / FOLD)),
                ),
            ),
        )
        this.addScript(() => this.cycle(), { loop: Infinity, margin: 30 })
    }

    // 中心のまわりを回る位置。t はフレーム数
    private at(t: number) {
        return this.center.add(vec.arg(-T / 4 + t / 600).scale(ORBIT))
    }

    private *move() {
        this.p = this.at(this.frame - ENTRANCE_FRAMES)
        yield
    }

    private *cycle() {
        yield* GenUtils.all({
            petals: this.petals(),
            needles: this.needles(),
            wait: Array(CYCLE_FRAMES),
        })
    }

    // 曲がりながら飛ぶ弾を少しずつ向きを変えて撃ち、六つに映して縦の鏡にも映す。花びらの模様になる
    private *petals() {
        const color = COLORS[Math.floor(this.random() * COLORS.length)]
        const base = this.random() * T
        const bend = (this.random() < 0.5 ? -1 : 1) * 0.012

        for (let f = 0; f < 120; f += 6) {
            yield* remodel(this)
                .format("diamond")
                .color(color)
                .p(this.p.clone())
                .radian(base + f * 0.03)
                .speed(2.4)
                .g((me) => Behavior.rotating(me, bend, 90))
                .rotational(this.center, FOLD)
                .mirror(this.center, T / 4)
                .fire(this.game.bullets)

            yield* Array(6)
        }
    }

    // 自機へ向けた3本の矢を、六つに映す
    private *needles() {
        yield* Array(200)

        for (let k = 0; k < 3; k++) {
            yield* remodel(this)
                .format("arrow")
                .color("#ffffff")
                .p(this.p.clone())
                .speed(0.5)
                .aim(this.game.player.p)
                .nway(3, T / 24)
                .g((me) => Behavior.accel(me, 50, 3.4))
                .rotational(this.center, FOLD)
                .fire(this.game.bullets)

            yield* Array(40)
        }
    }
}
