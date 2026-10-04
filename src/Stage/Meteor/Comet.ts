import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 流星道場の「彗星」。太陽(放った敵)の引力に引かれて、細長い楕円を描いて回る。
// 遠くではゆっくり、太陽に近いほど速い(ケプラーの法則)。通った跡に尾(止まった小さな弾)を残す
export namespace Comet {
    export type Config = {
        // 一周にかかるフレーム数と、何周して消えるか
        period: number
        orbits: number
        // 太陽に一番近づいたときの距離
        perihelion: number
        // 尾の弾を落とす間隔と、尾が残っている時間
        tailInterval: number
        tailLife: number
        color: Color
    }

    // 現れてから動き出すまで(提示)
    const APPEAR_FRAMES = 40
    // 1フレームを何回に分けて動きを計算するか。太陽のそばは速いので、細かく分けないと軌道が崩れる
    const SUBSTEPS = 8

    // 太陽から一番遠い点 aphelion に彗星を出し、太陽 sun のまわりを回らせる。turn は回る向き(1か-1)
    export function launch(sun: Enemy, aphelion: Vec, turn: number, config: Config) {
        const game = sun.game

        return remodel(sun)
            .format("big-ball")
            .r(14)
            .color(config.color)
            .p(aphelion.clone())
            .speed(0)
            .g(function* (me) {
                // 太陽の引力の強さは、一周の長さが config.period になるよう、楕円の大きさから決める
                const far = aphelion.sub(sun.p).magnitude()
                const a = (far + config.perihelion) / 2
                const gm = (4 * Math.PI ** 2 * a ** 3) / config.period ** 2

                yield* Behavior.appear(me, APPEAR_FRAMES)

                // 一番遠い点では、太陽へ向かう向きに垂直な速さだけを持つ
                const toSun = sun.p.sub(me.p)
                let v = vec.arg(toSun.radian() + (turn * T) / 4).scale(Math.sqrt(gm * (2 / far - 1 / a)))

                me.removeScript("boundary")

                for (let f = 0; f < config.period * config.orbits; f++) {
                    for (let s = 0; s < SUBSTEPS; s++) {
                        const d = sun.p.sub(me.p)
                        const r = Math.max(d.magnitude(), 20)
                        v = v.add(d.scale(gm / r ** 3 / SUBSTEPS))
                        me.p = me.p.add(v.scale(1 / SUBSTEPS))
                    }

                    me.radian = v.radian()

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

                yield* Behavior.fadeout(me, 20)
            })
    }
}
