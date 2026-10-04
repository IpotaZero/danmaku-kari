import { Ease, GenUtils } from "@ipota/functions"
import { Vec } from "@ipota/vec"
import { Behavior, remodel } from "../Remodel"
import { T } from "../../T"
import { Game } from "../Game"
import { Enemy } from "./Enemy"
import { Dom } from "../../Dom"
import { shakeElement } from "../../utils/Functions/shakeElement"

// ボス撃破演出は30FPSだった前作からの移植。同じ速さに見えるよう、フレーム数はこの倍率で伸ばし、速度は割る
const SCALE = 2

// 前作はスロー明けに30FPS→37FPSまで上げたまま大爆発させていた。その速さ
const RELEASE_SPEED = 1.2

// 敵の撃破演出。Gameのスクリプト(描画後に走る)として実行されるので、ここでctxに描いたものはそのフレームの最前面に乗る
export namespace DeathEffect {
    // 雑魚の撃破
    export function* explode(e: Enemy): Generator<void, void, void> {
        yield* particles(e, 31, { r: [8, 12], speed: [2, 4], alpha: 0.5, frame: 80 })
    }

    // ボスの撃破。スロー中に炸裂 → 速さが戻りきったところで大爆発
    export function* bossDefeat(e: Enemy): Generator<void, void, void> {
        const game = e.game
        const p = e.p.clone()
        const maxR = Math.hypot(game.WIDTH, game.HEIGHT)

        game.se.bossDefeatPre.play()

        yield* GenUtils.all({
            slowdown: slowdown(game),
            ...Object.fromEntries(
                [
                    { delay: 0, lw: 12, speed: 1.4 },
                    { delay: 4, lw: 8, speed: 1.7 },
                    { delay: 8, lw: 6, speed: 2.0 },
                    { delay: 12, lw: 5, speed: 2.3 },
                    { delay: 16, lw: 4, speed: 2.6 },
                ].map(({ delay, lw, speed }, i) => [
                    `ring${i}`,
                    (function* () {
                        yield* Array(delay * SCALE)
                        const frame = 60 * SCALE
                        for (let i = 1; i < frame + 1; i++) {
                            const r = Ease.Out(i / frame) * maxR * speed
                            ring(game, p, r, `rgba(255, 255, 255, ${(1 - i / frame) * 0.9})`, lw)

                            yield
                        }
                    })(),
                ]),
            ),
            pillars: pillars(game, p, maxR),
        })

        // ===== 大爆発 =====
        game.camera.shake(32, 8 * SCALE)
        shakeElement(Dom.container, 250, 32)
        game.se.bossDefeat.play()

        yield* particles(e, 128, {
            r: [8, 32],
            speed: [6 / SCALE, 28 / SCALE],
            alpha: 1,
            frame: 180 * SCALE,
            color: "white",
        })

        yield* GenUtils.all(
            Object.fromEntries(
                [
                    { delay: 0, hue: 0, lw: 14, speed: 2.0 },
                    { delay: 5, hue: 72, lw: 10, speed: 2.5 },
                    { delay: 10, hue: 144, lw: 8, speed: 3.0 },
                    { delay: 15, hue: 216, lw: 6, speed: 3.5 },
                    { delay: 20, hue: 288, lw: 5, speed: 4.0 },
                ].map(({ delay, hue, lw, speed }, i) => [
                    `ring${i}`,
                    (function* () {
                        yield* Array(delay * SCALE)
                        const frame = 90 * SCALE
                        for (let i = 1; i < frame + 1; i++) {
                            const r = Ease.Out(i / frame) * maxR * speed * 0.2
                            ring(game, p, r, `hsl(${hue} 50% 50% / ${1 - i / frame})`, lw)
                            yield
                        }
                    })(),
                ]),
            ),
        )

        game.setSpeed(1)
    }

    // 毎秒10回の更新まで落としてカクつかせ、通常より少し速いところまで戻す
    function* slowdown(game: Game) {
        const slow = 15 / 60

        game.setSpeed(slow)
        yield* Array(20)

        for (let i = 1; i < 10 + 1; i++) {
            game.setSpeed(slow + ((RELEASE_SPEED - slow) * i) / 10)
            yield* Array(6 * SCALE)
        }
    }

    // 回転しながら明滅する光の柱
    function* pillars(game: Game, p: Vec, length: number) {
        const frame = 60 * SCALE
        const num = 13

        for (let i = 0; i < frame; i++) {
            const alpha = i < frame / 2 ? i / (frame / 2) : (frame - i) / (frame / 2)

            draw(game, (ctx) => {
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`
                ctx.lineWidth = 3
                for (let j = 0; j < num; j++) {
                    const angle = (j / num) * T + (i / frame) * T
                    ctx.beginPath()
                    ctx.moveTo(p.x, p.y)
                    ctx.lineTo(p.x + Math.cos(angle) * length, p.y + Math.sin(angle) * length)
                    ctx.stroke()
                }
            })
            yield
        }
    }

    function* particles(
        e: Enemy,
        num: number,
        {
            r,
            speed,
            alpha,
            frame,
            color = "black",
        }: { r: [number, number]; speed: [number, number]; alpha: number; frame: number; color?: Color },
    ) {
        yield* remodel(e)
            .type("effect")
            .color(color)
            .alpha(alpha)
            .p(e.p.clone())
            .duplicate(num, (me) => {
                me.radian = Math.random() * T
                me.speed = Math.random() * (speed[1] - speed[0]) + speed[0]
                me.r = Math.random() * (r[1] - r[0]) + r[0]
                return me
            })
            .g((me) => Behavior.fadeout(me, frame))
            .fire(e.game.bullets)
    }

    function ring(game: Game, p: Vec, r: number, color: string, lineWidth: number) {
        draw(game, (ctx) => {
            ctx.strokeStyle = color
            ctx.lineWidth = lineWidth
            ctx.beginPath()
            ctx.arc(p.x, p.y, r, 0, T)
            ctx.stroke()
        })
    }

    // ワールド座標で描く
    function draw(game: Game, f: (ctx: CanvasRenderingContext2D) => void) {
        const ctx = game.ctx
        ctx.save()
        game.camera.apply(ctx, game.WIDTH, game.HEIGHT)
        f(ctx)
        ctx.restore()
    }
}
