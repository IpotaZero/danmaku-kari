import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"

// 流星道場の「流れ星」。
// 流れ星は、まず通り道に薄い予告線(当たり判定なし)が引かれ、そのあと画面の端から端まで一気に駆け抜ける。
// 駆け抜けた後には尾(止まった小さな弾)が残り、しばらくしてから消える。尾の弾は詰まっていて抜けられない
export namespace Meteor {
    export type Config = {
        // 予告線を引いてから流れ星が飛び出すまで(提示)
        preview: number
        speed: number
        // 尾の弾を落とす間隔と、尾が残っている時間
        tailInterval: number
        tailLife: number
        color: Color
    }

    // 点 through を通って向き angle に進む直線が、画面に入る点と出る点。画面にかからなければ undefined
    export function crossing(game: Game, through: Vec, angle: number): [Vec, Vec] | undefined {
        const d = vec.arg(angle)
        let enter = -Infinity
        let exit = Infinity

        for (const [p, v, size] of [
            [through.x, d.x, game.WIDTH],
            [through.y, d.y, game.HEIGHT],
        ]) {
            if (Math.abs(v) < 1e-9) {
                if (p < 0 || size < p) return undefined
                continue
            }

            const t0 = (0 - p) / v
            const t1 = (size - p) / v
            enter = Math.max(enter, Math.min(t0, t1))
            exit = Math.min(exit, Math.max(t0, t1))
        }

        if (enter >= exit) return undefined

        // 端ちょうどだとBulletのboundaryで消えることがあるので、少し内側にする
        return [through.add(d.scale(enter + 1)), through.add(d.scale(exit - 1))]
    }

    // 点 through を通って向き angle に、予告線を引いてから流れ星を流す
    export function* fall(e: Enemy, through: Vec, angle: number, config: Config) {
        const ends = crossing(e.game, through, angle)
        if (!ends) return

        const [start, end] = ends
        const game = e.game

        yield* remodel(e)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color(config.color)
            .r(2)
            .speed(0)
            .p(start)
            .radian(angle)
            .length(end.sub(start).magnitude())
            .alpha(0)
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0.15, 15)
                yield* Array(config.preview - 15)
                yield* Behavior.fadeout(me, 10)
            })
            .fire(game.bullets)

        yield* Array(config.preview)
        if (e.life <= 0) return

        yield* remodel(e)
            .format("big-ball")
            .r(16)
            .color(config.color)
            .p(start)
            .radian(angle)
            .speed(config.speed)
            .g(function* (me) {
                for (let f = 0; me.life > 0; f++) {
                    if (f % config.tailInterval === 0) {
                        yield* remodel(this)
                            .format("small-ball")
                            .r(5)
                            .color(config.color)
                            .p(me.p.clone())
                            .speed(0)
                            .g(function* (tail) {
                                yield* Array(config.tailLife)
                                yield* Behavior.fadeout(tail, 20)
                            })
                            .fire(game.bullets)
                    }

                    yield
                }
            })
            .fire(game.bullets)
    }
}
