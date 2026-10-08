import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 月の草むらの「餅」。放り投げられた大きな餅は、重さに引かれて放物線を描き、画面の底で弾む。
// 弾むたびに、底から上へ向かって半円の衝撃波(小さな弾)が広がる。弾むたびに少しずつ低くなり、何度か弾むと消える。
// 左右の壁でも跳ね返る
export namespace Mochi {
    export type Config = {
        // 重さ(1フレームあたりに下向きに増える速さ)と、弾んだときに残る速さの割合
        gravity: number
        restitution: number
        // 何回弾んだら消えるか
        bounces: number
        // 衝撃波の弾の数と速さ
        waveCount: number
        waveSpeed: number
        color: Color
    }

    const R = 22

    // e から、landing の真上の高さ peak を通って landing に落ちる放物線で餅を放る
    export function toss(e: Enemy, landing: Vec, peak: number, config: Config) {
        const game = e.game
        const floor = game.HEIGHT - R

        return remodel(e)
            .format("big-ball")
            .r(R)
            .color(config.color)
            .p(e.p.clone())
            .speed(0)
            .unbounded()
            .g(function* (me) {
                // 最初の放物線は、いまの位置から peak まで上がって landing へ落ちる
                const up = Math.max(0, me.p.y - peak)
                const down = landing.y - peak
                const rise = Math.sqrt((2 * up) / config.gravity)
                const fall = Math.sqrt((2 * down) / config.gravity)
                let v = vec((landing.x - me.p.x) / (rise + fall), -config.gravity * rise)

                for (let bounce = 0; bounce < config.bounces && me.life > 0;) {
                    v = v.add(vec(0, config.gravity))
                    me.p = me.p.add(v)

                    if (me.p.x < R || game.WIDTH - R < me.p.x) {
                        me.p.x = Math.min(Math.max(me.p.x, R), game.WIDTH - R)
                        v = vec(-v.x, v.y)
                    }

                    if (me.p.y > floor && v.y > 0) {
                        me.p.y = floor
                        v = vec(v.x, -v.y * config.restitution)
                        bounce++

                        yield* remodel(this)
                            .format("small-ball")
                            .color(config.color)
                            .p(vec(me.p.x, game.HEIGHT - 4))
                            .speed(config.waveSpeed)
                            .radian(-T / 4)
                            .nway(config.waveCount, T / 2 / (config.waveCount - 1))
                            .fire(game.bullets)
                    }

                    me.radian = v.radian()
                    yield
                }

                yield* Behavior.fadeout(me, 20)
            })
    }
}
