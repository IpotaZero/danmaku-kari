import { Vec, vec } from "@ipota/vec"
import { Actor } from "../../Game/Actor/Actor"
import { Behavior, Remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 弾を弧に並べた鎌。手元で研がれて(大きさ0から育って)から投げられ、回りながら目標のそばまで飛び、輪を描いて投げた場所へ戻る。
// 行きと帰りで違う側を通るので、一度かわしても帰りの鎌がもう一度来る
export namespace Sickle {
    // 鎌を研いでいる時間(提示)と、投げてから戻るまでの時間
    export const SHARPEN_FRAMES = 40
    export const FLIGHT_FRAMES = 160
    export const TOTAL_FRAMES = SHARPEN_FRAMES + FLIGHT_FRAMES + 15

    // 鎌の刃。半径 BLADE_RADIUS の円弧を BLADE_SPAN だけ切り取った形に、BLADE_SPACING おきに弾を並べる。
    // 刃の弾の間隔は自機の当たり判定の8倍より狭いので、刃は抜けられない
    const BLADE_RADIUS = 80
    const BLADE_SPAN = T / 3
    const BLADE_SPACING = 14
    // 1フレームあたりの鎌の回転
    const SPIN = T / 70
    // 鎌が描く輪の膨らみ。行きと帰りで通り道がこれだけずれる
    const LOOP_SWELL = 110

    // 鎌の形。回転の中心(刃の重心)から見た弾の位置を返す
    function blade(): Vec[] {
        const count = Math.ceil((BLADE_RADIUS * BLADE_SPAN) / BLADE_SPACING)
        const centroid = vec((BLADE_RADIUS * Math.sin(BLADE_SPAN / 2)) / (BLADE_SPAN / 2), 0)

        return Array.from({ length: count + 1 }, (_, i) =>
            vec
                .arg(BLADE_SPAN * (i / count - 0.5))
                .scale(BLADE_RADIUS)
                .sub(centroid),
        )
    }

    // start から target へ鎌を投げる。loop は輪を描く向き(1か-1。逆にすると鏡写しの輪になり、鎌の回る向きも逆になる)。
    // angle は投げたときの刃の向き
    export function cast<Parent extends Actor>(
        r: Remodel<Parent>,
        start: Vec,
        target: Vec,
        loop: number,
        angle: number,
    ) {
        const forward = target.sub(start)
        const normal = vec(-forward.y, forward.x).normalize().scale(loop)
        const course = (t: number) =>
            start.add(forward.scale(Math.sin(Math.PI * t))).add(normal.scale(LOOP_SWELL * Math.sin(T * t)))

        const offsets = blade()
        const spin = SPIN * -loop

        return r
            .format("wedge")
            .speed(0)
            .duplicate(offsets.length, (b, i) => {
                b.p = start.add(offsets[i].rotate(angle))
                b.radian = offsets[i].radian() + angle + T / 4
                return b
            })
            .g(function* (me, i) {
                // 刃が画面の外へはみ出しても、戻ってくるまで消さない
                me.removeScript("boundary")
                yield* Behavior.appear(me, SHARPEN_FRAMES)

                for (let f = 1; f <= FLIGHT_FRAMES; f++) {
                    const a = angle + spin * f
                    me.p = course(f / FLIGHT_FRAMES).add(offsets[i].rotate(a))
                    me.radian = offsets[i].radian() + a + T / 4
                    yield
                }

                yield* Behavior.fadeout(me, 15)
            })
    }
}
