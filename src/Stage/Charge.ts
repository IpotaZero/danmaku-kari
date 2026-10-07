import { vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Behavior, remodel } from "../Game/Remodel"
import { T } from "../T"

// 敵が力を溜める演出。どの粒も見た目だけで、当たり判定はない。
// 溜めている間に攻撃をさせないことや、攻撃を効かなくすることは、呼ぶ側で決める
export namespace Charge {
    // frames の間、まわりから光の粒が渦を巻いて e へ吸い込まれていき、最後に光の輪が弾ける
    export function* gather(e: Enemy, frames: number, color: Color) {
        // 粒は30フレームかけて吸い込まれるので、最後の粒が吸い込まれ終わる所で弾けるよう、少し早めに出し終える
        for (let f = 0; f < frames - 30; f += 2) {
            yield* remodel(e)
                .format("small-ball")
                .type("effect")
                .isScorable(false)
                .color(color)
                .alpha(0.7)
                .speed(0)
                .unbounded()
                .g(function* (b) {
                    const angle = this.random() * T
                    const radius = 110 + this.random() * 90

                    for (let k = 0; k < 30; k++) {
                        b.p = e.p.add(vec.arg(angle + k * 0.04).scale(radius * (1 - k / 30)))
                        yield
                    }

                    b.life = 0
                })
                .fire(e.game.bullets)
            yield* Array(2)
        }

        yield* Array(30)

        yield* remodel(e)
            .format("big-ball")
            .type("effect")
            .isScorable(false)
            .color(color)
            .alpha(0.6)
            .p(e.p.clone())
            .speed(8)
            .radian(e.random() * T)
            .ex(36)
            .g((b) => Behavior.fadeout(b, 30))
            .fire(e.game.bullets)
    }
}
