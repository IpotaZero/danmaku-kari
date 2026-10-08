import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../Game/Actor/Enemy"
import { Behavior, remodel } from "../Game/Remodel"
import { T } from "../T"

// 敵が力を溜める演出。どの粒も見た目だけで、当たり判定はない。
// 溜めている間に攻撃をさせないことや、攻撃を効かなくすることは、呼ぶ側で決める。
// 弾ける瞬間に画面をその色で光らせるので、color は #rrggbb の形で渡す
export namespace Charge {
    // frames の間、力を溜める。まわりから光の粒が渦を巻いて吸い込まれ、光の輪が何度も縮んでいき、画面がだんだん強く揺れる。
    // 溜め終わると、画面が光り、何重もの光の輪と火花が弾ける
    export function* gather(e: Enemy, frames: number, color: Color) {
        // 粒も輪も30フレームかけて吸い込まれるので、最後の粒が吸い込まれ終わる所で弾けるよう、少し早めに出し終える
        for (let f = 0; f < frames - 30; f += 2) {
            yield* particle(e, color)
            yield* particle(e, "#ffffff")

            if (f % 24 === 0) {
                yield* ring(e, color)
                e.game.camera.shake(1 + (6 * f) / frames, 24)
            }

            yield* Array(2)
        }

        yield* Array(30)
        yield* burst(e, color)
    }

    // 光の粒を一つ、まわりから渦を巻いて e へ吸い込ませる(30フレームかかる)
    export function* particle(e: Enemy, color: Color) {
        yield* remodel(e)
            .format(e.random() < 0.3 ? "big-ball" : "small-ball")
            .type("effect")
            .isScorable(false)
            .color(color)
            .alpha(0.8)
            .speed(0)
            .unbounded()
            .g(function* (b) {
                const angle = this.random() * T
                const radius = 120 + this.random() * 180

                for (let k = 0; k < 30; k++) {
                    b.p = e.p.add(vec.arg(angle + k * 0.05).scale(radius * (1 - Ease.In(k / 30))))
                    yield
                }

                b.life = 0
            })
            .fire(e.game.bullets)
    }

    // 光の輪が、回りながら e へ縮んでいく(30フレームかかる)
    export function* ring(e: Enemy, color: Color) {
        yield* remodel(e)
            .format("small-ball")
            .type("effect")
            .isScorable(false)
            .color(color)
            .alpha(0.9)
            .speed(0)
            .unbounded()
            .duplicate(32, (b, i) => {
                b.radian = (T * i) / 32
                return b
            })
            .g(function* (b) {
                const angle = b.radian

                for (let k = 0; k < 30; k++) {
                    b.p = e.p.add(vec.arg(angle - k * 0.06).scale(260 * (1 - Ease.In(k / 30))))
                    yield
                }

                b.life = 0
            })
            .fire(e.game.bullets)
    }

    // 溜めた力が弾ける。画面が光って大きく揺れ、速さの違う三重の光の輪と、ばらばらの火花が広がる
    export function* burst(e: Enemy, color: Color) {
        e.game.stage.flash(color + "c0", 25)
        e.game.camera.shake(12, 40)

        for (const [k, speed] of [11, 7, 4].entries()) {
            yield* remodel(e)
                .format(k === 1 ? "small-ball" : "big-ball")
                .type("effect")
                .isScorable(false)
                .color(k === 1 ? "#ffffff" : color)
                .alpha(0.7)
                .p(e.p.clone())
                .speed(speed)
                .radian(e.random() * T)
                .ex(40 - k * 8)
                .g((b) => Behavior.fadeout(b, 45))
                .fire(e.game.bullets)
        }

        yield* remodel(e)
            .format("small-ball")
            .type("effect")
            .isScorable(false)
            .color(color)
            .alpha(0.9)
            .p(e.p.clone())
            .duplicate(40)
            .scatter({ radian: [0, T], speed: [2, 13] })
            .g((b) => Behavior.fadeout(b, 50))
            .fire(e.game.bullets)
    }
}
