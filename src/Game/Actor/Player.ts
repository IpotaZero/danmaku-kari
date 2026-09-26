import { Actor } from "./Actor"
import { Game } from "../Game"
import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { remodel } from "../Remodel"
import { Ease } from "@ipota/functions"

export class Player extends Actor {
    readonly GRAZE_R = 16

    override readonly r: number = 2

    private readonly maxLife = 8
    private frame = 0

    private readonly speed = 8
    private readonly slowSpeed = 3

    private readonly fireCooldown = 6
    private readonly bulletSpeed = 20
    private readonly bulletR = 3

    // 低速(スニーク)時の見た目まわり
    private drawRadianVelocity = 0
    private drawRadian = 0
    private sneakProgress = 0 // 0.0〜1.0、低速中に1へ近づく

    constructor(game: Game, startPosition: Vec) {
        super(game)
        this.p = startPosition
        this.life = this.maxLife

        this.addScript(() => this.fireLoop(), { loop: Infinity })
    }

    update(): void {
        super.update()
        this.frame++
        this.move()
        this.updateDrawRadian()
        this.updateSneakProgress()
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save()
        ctx.globalAlpha = this.isInvincible() ? 0.5 : 1

        this.drawSneakEffect(ctx)
        this.drawNormalEffect(ctx)
        this.drawLife(ctx)
        this.drawGrazeBoundary(ctx)
        this.drawCore(ctx)

        ctx.restore()
    }

    isInvincible() {
        return this.scripts.has("invincible")
    }

    // 被弾処理: ライフを減らし、しばらく無敵にする
    hit(damage: number) {
        if (this.isInvincible()) return

        this.life = Math.max(0, this.life - damage)

        this.addScript(
            function* () {
                const invincibleFrame = 120
                yield* Array(invincibleFrame)
            },
            { id: "invincible" },
        )

        this.addScript(() => this.hitField(), { id: "hitField" })

        if (this.life <= 0) {
            this.game.lose()
        }
    }

    // 被弾した瞬間に自機を中心としたリングを広げ、触れた敵弾をスコアに変える。
    // 無敵時間と同じくaddScript任せで進行させ、見た目もこの中で完結させて描いてしまう
    // (Playerに専用フィールドを持たせない)
    private *hitField() {
        const frame = 90
        const center = this.p.clone()
        const ctx = this.game.ctx

        for (let i = 1; i < frame + 1; i++) {
            const radius = Ease.Out(i / frame) * this.game.WIDTH
            const alpha = 1 - i / frame

            this.game.bullets
                .filter((b) => b.type === "enemy")
                .filter((b) => b.isScorable)
                .filter((b) => b.p.sub(center).magnitude() <= radius)
                .forEach((b) => {
                    b.life = 0
                    this.game.score++
                })

            ctx.save()
            this.game.camera.apply(ctx, this.game.WIDTH, this.game.HEIGHT)
            Ctx.arc(ctx, center, radius, `rgba(255, 255, 255, ${alpha})`, { lineWidth: 2 })
            ctx.restore()

            yield
        }
    }

    private *fireLoop() {
        if (!this.game.input.isPressed("ok")) {
            yield
            return
        }

        if (this.game.input.isPressed("slow")) {
            yield* remodel(this)
                .p(this.p.clone())
                .radian(-T / 4)
                .appearance("player")
                .type("friend")
                .color("white")
                .alpha(0.5)
                .r(this.bulletR)
                .shift(5, 20)
                .speed(this.bulletSpeed)
                .fire(this.game.bullets)
        } else {
            yield* remodel(this)
                .p(this.p.clone())
                .radian(-T / 4)
                .appearance("player")
                .type("friend")
                .color("white")
                .alpha(0.5)
                .r(this.bulletR)
                .nway(5, T / 32)
                .speed(this.bulletSpeed)
                .fire(this.game.bullets)
        }
        yield* Array(this.fireCooldown)
    }

    private move() {
        const input = this.game.input

        const dir = vec(
            (input.isPressed("right") ? 1 : 0) - (input.isPressed("left") ? 1 : 0),
            (input.isPressed("down") ? 1 : 0) - (input.isPressed("up") ? 1 : 0),
        )
        if (dir.magnitude() === 0) return

        const speed = input.isPressed("slow") ? this.slowSpeed : this.speed
        const next = this.p.add(dir.normalize().scale(speed))

        this.p = vec(Math.min(Math.max(next.x, 0), this.game.WIDTH), Math.min(Math.max(next.y, 0), this.game.HEIGHT))
    }

    // 左右移動に応じてゆっくり回転する角度(スニーク時の多角形の回転に使う)
    private updateDrawRadian() {
        const input = this.game.input

        if (input.isPressed("right")) this.drawRadianVelocity = 10
        if (input.isPressed("left")) this.drawRadianVelocity = -10

        if (this.drawRadianVelocity > 0) {
            this.drawRadian += this.drawRadianVelocity
            this.drawRadianVelocity--
        } else if (this.drawRadianVelocity < 0) {
            this.drawRadian += this.drawRadianVelocity
            this.drawRadianVelocity++
        }
    }

    private updateSneakProgress() {
        const target = this.game.input.isPressed("slow") ? 1 : 0
        this.sneakProgress += (target - this.sneakProgress) * 0.15
        if (Math.abs(this.sneakProgress - target) < 0.001) this.sneakProgress = target
    }

    private drawSneakEffect(ctx: CanvasRenderingContext2D) {
        const ratio = this.sneakProgress
        if (ratio < 0.001) return

        Ctx.arc(ctx, this.p, this.GRAZE_R * 3 * ratio, "#ffffff80", { lineWidth: 1 })
        Ctx.arc(ctx, this.p, this.GRAZE_R * 2.8 * ratio, "#ffffff80", { lineWidth: 1 })
        Ctx.polygon(ctx, 13, 2, this.p, this.GRAZE_R * 2.7 * ratio, "#ffffff80", {
            theta: this.drawRadian / 72,
            lineWidth: 1,
        })
        Ctx.polygon(ctx, 11, 2, this.p, this.GRAZE_R * 2 * ratio, "#ffffff80", {
            theta: this.drawRadian / 144,
            lineWidth: 1,
        })
    }

    // 通常時の見た目。スニーク中はその分だけ縮んで消え、スニーク解除で元の大きさへ戻る
    private drawNormalEffect(ctx: CanvasRenderingContext2D) {
        const ratio = 1 - this.sneakProgress
        if (ratio < 0.001) return

        Ctx.polygon(ctx, 8, 2, this.p, this.GRAZE_R * 2.2 * ratio, "#ffffff40", {
            theta: this.drawRadian / 100,
            lineWidth: 1,
        })
    }

    private drawCore(ctx: CanvasRenderingContext2D) {
        Ctx.arc(ctx, this.p, this.r, "red", { lineWidth: 0 })
    }

    private drawGrazeBoundary(ctx: CanvasRenderingContext2D) {
        Ctx.arc(ctx, this.p, this.GRAZE_R, "#ffffff60", { lineWidth: 2 })
    }

    private drawLife(ctx: CanvasRenderingContext2D) {
        for (let i = 0; i < this.life; i++) {
            const center = this.p.add(vec(this.GRAZE_R * 3.5, 0).rotate(T * (i / this.maxLife) + this.frame / 60))
            Ctx.polygon(ctx, 4, 1, center, this.GRAZE_R, "#ffffff80", { theta: this.frame / 60, lineWidth: 1 })
        }
    }
}
