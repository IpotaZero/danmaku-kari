import { Vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"

// 月影道場の「影」。自機の少し後ろを、自機が通った道筋どおりに影(薄く、当たり判定なし)がついてくる。
// 影は一定の間隔で足跡(実体の弾)を残す。足跡はしばらく残ってから消える。
// 立ち止まっていると影に追いつかれて足跡を踏まれるので、動き続ける。通ったばかりの道へは戻れない
export namespace Shadow {
    export type Config = {
        // 影が自機から何フレーム遅れてついてくるか
        delay: number
        // 足跡を残す間隔と、足跡が残っている時間
        stepInterval: number
        stepLife: number
        // 影が足跡を残し続ける時間
        frames: number
        color: Color
    }

    // 足跡が大きさ0から育ちきるまで
    const GROW_FRAMES = 14

    // e が自機の道筋を覚え、影に追わせて足跡を残させる
    export function* follow(e: Enemy, config: Config) {
        const game = e.game
        const history: Vec[] = []
        const past = () => history[Math.max(0, history.length - 1 - config.delay)]

        history.push(game.player.p.clone())

        // 影。足跡を残している間だけ現れる
        const shadow = remodel(e)
            .format("small-ball")
            .r(9)
            .color(config.color)
            .type("neutral")
            .alpha(0)
            .speed(0)
            .isScorable(false)
            .p(past())
            .g(function* (me) {
                me.removeScript("boundary")

                for (let f = 0; f < config.frames + 20; f++) {
                    me.p = past()
                    me.alpha = 0.35 * Math.min(1, f / 20, (config.frames + 20 - f) / 20)
                    yield
                }

                me.life = 0
            })

        yield* shadow.fire(game.bullets)

        for (let f = 0; f < config.frames; f++) {
            history.push(game.player.p.clone())

            if (f >= config.delay && f % config.stepInterval === 0) {
                yield* remodel(e)
                    .format("small-ball")
                    .r(7)
                    .color(config.color)
                    .speed(0)
                    .p(past().clone())
                    .g(function* (me) {
                        yield* Behavior.appear(me, GROW_FRAMES)
                        yield* Array(config.stepLife)
                        yield* Behavior.fadeout(me, 20)
                    })
                    .fire(game.bullets)
            }

            yield
        }
    }
}
