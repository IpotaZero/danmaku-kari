import { Vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"

// 霧隠道場主の「灯籠」。
// 道場主の撃つ弾は、はじめは霧(薄く、当たり判定なし)で、どこを飛んでも当たらない。
// ところが灯の光の中を通り抜けると、霧は照らされて形を得て、そこから先はずっと実体の弾になる。
// 灯の向こう側には実体の弾が光の筋のように伸びるので、その筋の中に入らないようにする。
// 灯を撃って消せば、その灯の筋は出なくなる
export namespace Lantern {
    const MIST: Color = "#c8d0e0"
    const LIT: Color = "#ffc070"
    const MIST_ALPHA = 0.16
    // 光の中へどれだけ入り込んだら(中心からの距離が半径の何割まで来たら)照らされきるか
    const LIT_DEPTH = 0.45

    export type Light = {
        // 灯の位置と、光の届く半径
        p: () => Vec
        radius: () => number
        // 灯が消えたら偽になる
        alive: () => boolean
    }

    // 画面にある灯の集まり
    export class Field {
        private lights: Light[] = []

        add(light: Light) {
            this.lights.push(light)
        }

        // p がどれだけ光の奥にいるか(0なら光の外、1なら灯のど真ん中)。いくつもの灯の中では、一番奥のもの
        depth(p: Vec): number {
            let deepest = 0

            for (const l of this.lights) {
                if (!l.alive()) continue
                deepest = Math.max(deepest, 1 - p.sub(l.p()).magnitude() / l.radius())
            }

            return deepest
        }

        // 消えた灯を忘れる
        forget() {
            this.lights = this.lights.filter((l) => l.alive())
        }
    }

    // 弾 me を霧にする。霧は光の中へ入ると濃くなっていき、十分奥まで入ると照らされて実体になる(その後はずっと実体)。
    // 奥まで入らずに光から出た霧は、また薄い霧に戻る
    export function* mist(me: Bullet, field: Field) {
        me.type = "neutral"
        me.color = MIST
        me.alpha = MIST_ALPHA

        while (me.life > 0) {
            const lit = Math.min(1, field.depth(me.p) / LIT_DEPTH)

            if (lit >= 1) {
                me.type = "enemy"
                me.color = LIT
                me.alpha = 1
                return
            }

            me.alpha = MIST_ALPHA + (1 - MIST_ALPHA) * lit
            yield
        }
    }

    // e が生きている間、e のまわりに灯の光を描く
    export function* glow(e: Enemy, light: Light) {
        while (light.alive()) {
            const p = light.p()
            const r = light.radius()
            const flicker = 0.9 + 0.1 * Math.sin(e.frame / 5) * Math.sin(e.frame / 13)

            e.game.drawInWorld((ctx) => {
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
                gradient.addColorStop(0, `rgba(255, 200, 120, ${0.35 * flicker})`)
                gradient.addColorStop(LIT_DEPTH, `rgba(255, 180, 100, ${0.18 * flicker})`)
                gradient.addColorStop(1, "rgba(255, 160, 80, 0)")
                ctx.fillStyle = gradient
                ctx.beginPath()
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
                ctx.fill()

                // 照らされきる深さの目安
                ctx.strokeStyle = `rgba(255, 210, 150, ${0.25 * flicker})`
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.arc(p.x, p.y, r * (1 - LIT_DEPTH), 0, Math.PI * 2)
                ctx.stroke()
            })

            yield
        }
    }
}
