import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, Format, Remodel, remodel } from "../../Game/Remodel"
import { BulletCollision } from "../../Game/BulletCollision"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"

// 確認用「当たり判定」
// すべての種類の弾を画面に並べて止めておく。弾はゆっくり回るので、向きのある弾もあらゆる角度で確かめられる。
// 自機が弾に触れている間、その弾は赤くなる。判定には本番と同じBulletCollisionを使うので、
// 「見た目では触れていないのに赤い」「見た目では触れているのに白い」なら、見た目と当たり判定がずれている。
// 弾はneutralなので被弾はしない。上の的を倒すと終了。

// 弾が1周するのにかかるフレーム数
const SPIN_FRAMES = 1200
const COLOR_IDLE = "#ffffff"
const COLOR_HIT = "#ff3355"

// 並べる弾。formatで作れるものに加え、formatにない多角形もそのまま並べる
const SAMPLES: ((r: Remodel<Enemy>) => Remodel<Enemy>)[] = [
    ...Format.format.map((type) => (r: Remodel<Enemy>) => r.format(type)),
    (r) => r.beam(1000),
    (r) => r.laser(30, 10000, vec(0, 0), vec(1000, 0)),
]

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say([
            "当たり判定の確認用ステージ。<br>弾に触れている間、その弾は赤くなる。被弾はしない。<br>上の的を倒すと終了。",
        ])

        this.game.enemies.push(new EnemyTarget(this.game))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyTarget extends Enemy {
    constructor(game: Game) {
        super(game, 30000, 48, { renderer: new EnemyRendererCore() })

        this.p = vec(game.WIDTH / 2, game.HEIGHT * 0.12)
        this.addScript(() => this.lineUp())
    }

    // 弾を2列に並べる。的が倒れるまで、自機に触れているかどうかで色を変え続ける
    private *lineUp() {
        const collision = new BulletCollision()
        const columns = 2
        const rows = Math.ceil(SAMPLES.length / columns)
        const width = this.game.WIDTH
        const height = this.game.HEIGHT

        for (const [i, sample] of SAMPLES.entries()) {
            const column = i % columns
            const row = Math.floor(i / columns)

            yield* sample(remodel(this))
                .type("neutral")
                .color(COLOR_IDLE)
                .speed(0)
                .p(vec((width * (column + 1)) / (columns + 1), height * (0.3 + (0.6 * row) / (rows - 1))))
                .g(function* (me) {
                    while (this.life > 0) {
                        me.type = "neutral"
                        me.radian += T / SPIN_FRAMES
                        me.color = collision.isColliding(me, this.game.player) ? COLOR_HIT : COLOR_IDLE
                        yield
                    }

                    yield* Behavior.fadeout(me, 30)
                })
                .fire(this.game.bullets)
        }
    }
}
