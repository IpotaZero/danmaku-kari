import { Enemy } from "../../Game/Actor/Enemy"
import { remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 月の草むらの「満ち欠け」。輪の一部だけが照らされていて、照らされた弧だけが実体になる(影の側は薄く、当たり判定がない)
export namespace Phase {
    export type Ring = {
        count: number
        speed: number
        color: Color
    }

    const SHADOW_ALPHA = 0.18

    // e から輪を広げる。light は照らされる向き、lit は照らされている割合(0で新月、1で満月)
    export function ring(e: Enemy, config: Ring, light: number, lit: number) {
        // 輪の弾の向きと light のなす角の cos がこれより大きければ照らされている
        const threshold = Math.cos(Math.PI * lit)

        return remodel(e)
            .format("diamond")
            .color(config.color)
            .p(e.p.clone())
            .speed(config.speed)
            .radian(light + T / config.count / 2)
            .ex(config.count)
            .forEach((b) => {
                if (Math.cos(b.radian - light) <= threshold) {
                    b.type = "neutral"
                    b.alpha = SHADOW_ALPHA
                    b.isScorable = false
                }
            })
    }
}
