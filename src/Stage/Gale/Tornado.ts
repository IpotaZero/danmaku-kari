import { Actor } from "../../Game/Actor/Actor"
import { Game } from "../../Game/Game"
import { Behavior, Remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 弾を楕円に並べた輪を縦に積んだ竜巻。輪は回り続け、奥側の弾は薄く当たり判定がない(手前の弾だけが実体)。
// 輪ごとに回り方を少しずつずらすので、手前の弾は斜めの縞になって流れる。
// 縞と縞の間(縦にずれた間隔)は STRIPE_GAP px になる。縞は1フレームに SPIN / TWIST px ずつ縦に流れる
export namespace Tornado {
    // 竜巻ができあがるまで(この間はすべて薄い。弾幕の提示)
    export const FORM_FRAMES = 70
    // 竜巻が画面を横切る時間
    export const TRAVEL_FRAMES = 330
    const FADE_FRAMES = 30
    export const TOTAL_FRAMES = FORM_FRAMES + TRAVEL_FRAMES + FADE_FRAMES

    // 輪の縦の間隔。手前の縞の弾の間隔はこれより狭いので、縞は抜けられない
    const RING_GAP = 16
    // 1つの輪の弾の数
    const SLOTS = 8
    // 楕円の奥行き(縦の半径)
    const DEPTH = 8
    // 竜巻の太さ。上ほど太い
    const TOP_WIDTH = 300
    const BOTTOM_WIDTH = 90
    // 1フレームあたりの輪の回転と、縞の縦の間隔
    const SPIN = T / 400
    const STRIPE_GAP = 130
    const TWIST = T / SLOTS / STRIPE_GAP

    const FRONT_R = 6
    const BACK_R = 4

    // side の側(-1で左、1で右)の端に竜巻を立て、反対の端の外まで横切らせる。phase は輪の回り方の初期値
    export function spin<Parent extends Actor>(r: Remodel<Parent>, game: Game, side: number, phase: number) {
        const width = game.WIDTH
        const height = game.HEIGHT
        const rings = Math.ceil(height / RING_GAP)
        const startX = width / 2 + side * width * 0.38
        const endX = width / 2 - side * (width / 2 + TOP_WIDTH / 2 + 20)

        return r
            .format("small-ball")
            .type("neutral")
            .speed(0)
            .isScorable(false)
            .duplicate(rings * SLOTS, (b, i) => {
                b.p.y = (Math.floor(i / SLOTS) + 0.5) * RING_GAP
                return b
            })
            .g(function* (me, i) {
                // 竜巻ははみ出して画面の外へ抜けていくので、端で消さない
                me.removeScript("boundary")

                const y = me.p.y
                const w = BOTTOM_WIDTH + (TOP_WIDTH - BOTTOM_WIDTH) * (1 - y / height)
                const slot = phase + (T * (i % SLOTS)) / SLOTS + TWIST * y

                for (let f = 0; f < FORM_FRAMES + TRAVEL_FRAMES; f++) {
                    const travel = Math.max(0, f - FORM_FRAMES) / TRAVEL_FRAMES
                    const theta = slot + SPIN * f
                    const front = f >= FORM_FRAMES && Math.sin(theta) > 0

                    me.p.x = startX + (endX - startX) * travel + (w / 2) * Math.cos(theta)
                    me.p.y = y + DEPTH * Math.sin(theta)
                    me.type = front ? "enemy" : "neutral"
                    me.alpha = front ? 1 : 0.25
                    me.r = front ? FRONT_R : BACK_R
                    yield
                }

                yield* Behavior.fadeout(me, FADE_FRAMES)
            })
    }
}
