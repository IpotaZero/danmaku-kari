import { vec } from "@ipota/vec"
import { Actor } from "../../Game/Actor/Actor"
import { Bullet } from "../../Game/Actor/Bullet"
import { Behavior } from "../../Game/Remodel"

// 流星道場の「引力」。重い星のそばを通る弾は、星へ引き寄せられて曲がる。近すぎる弾は星に呑み込まれて消える
export namespace Gravity {
    export type Config = {
        // 引力の強さ(距離 r での加速度は gm / r²)
        gm: number
        // これより近づいた弾は呑み込まれる
        horizon: number
    }

    // star が生きている間、弾 me を star へ引き寄せ続ける
    export function* pull(me: Bullet, star: Actor, config: Config) {
        while (star.life > 0) {
            const d = star.p.sub(me.p)
            const r = d.magnitude()

            if (r < config.horizon) {
                yield* Behavior.fadeout(me, 6)
                return
            }

            const v = vec
                .arg(me.radian)
                .scale(me.speed)
                .add(d.scale(config.gm / r ** 3))
            me.speed = v.magnitude()
            me.radian = v.radian()
            yield
        }
    }
}
