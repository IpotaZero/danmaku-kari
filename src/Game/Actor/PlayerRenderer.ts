import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import type { Player } from "./Player"

// 残像1コマ分のスナップショット
type AfterImage = { p: Vec; alpha: number }

const AFTER_IMAGE_MAX = 18
const AFTER_IMAGE_DECAY = 0.05

// 蜂の体(翅を含む)と、そのまわりの多角形・円の大きさの倍率(当たり判定・かすり判定の大きさは変えない)
const BODY_SCALE = 2.24
const EFFECT_SCALE = 1.44

// ミツバチの翅の形(体の座標、BODY_SCALE倍する前)。根元を(0,0)、翅の先を+x、前縁(頭の側)を-yに向けて描く
namespace WingShape {
    // 前翅。根元は細く、先の方で幅が広がり、先端は丸い
    export const fore = new Path2D(
        "M0 -0.5 C6 -2.2 12 -3 18 -3.4 C25 -3.8 30 -2.6 30 -0.4 C30 2.4 26 4.6 20 4.6 C13 4.6 7 3 3 1.6 C1.5 1 0.3 0.6 0 0.3 Z",
    )
    // 前翅の翅脈。前縁沿いの縁紋と細長い縁室、真ん中に並ぶ小さな部屋(亜縁室)
    export const foreVeins = new Path2D(
        "M1 -0.6 C6 -1.6 12 -2.4 17 -2.9 M17 -2.9 Q22 -1.4 26.5 -2.6 M2 0.4 C6 0.5 9 0.6 12 0.6 L16 -2.2 M12 0.6 L19 1.4 L21.5 -1.6 M19 1.4 L16 3.6 M12 0.6 L10 3.6",
    )
    // 後翅。前縁はまっすぐで(ここで前翅と鉤でつながる)、後ろ側は丸く、根元近くに小さな切れ込みがある
    export const hind = new Path2D(
        "M0 -0.5 L13 -2.2 C17 -2.6 20 -1.6 20 0 C20 1.8 16 3.6 10 3.6 C8 3.6 7 3 6 2.6 Q5 2 4 2.8 C2 2.4 0.5 1.6 0 0.8 Z",
    )
    export const hindVeins = new Path2D("M1 -0.2 L10 -0.6 M10 -0.6 L13 1.6 M10 -0.6 L15 -1.6")
}

/**
 * Playerの見た目。描画のためだけの状態(揺れ・傾き・スニークやブーストの進み具合・残像)もここで持つ。
 * Playerはupdate()とdraw()を呼ぶだけで、見た目のことは何も知らない
 */
export class PlayerRenderer {
    frame = 0

    // 蜂らしい飛び方の見た目まわり。体と翅は、当たり判定(player.p)からhoverだけずらして描く
    hover: Vec = vec(0, 0)
    // 横への傾き。速度にすぐには追いつかず、遅れて傾く
    bank = 0

    // 低速(スニーク)時の見た目まわり
    drawRadianVelocity = 0
    drawRadian = 0
    sneakProgress = 0 // 0.0〜1.0、低速中に1へ近づく

    // ブースト(ダッシュ等でboostSpeedが設定されている状態)時の見た目まわり
    dashProgress = 0 // 0.0〜1.0、ブースト中に1へ近づく
    readonly afterImages: AfterImage[] = []

    update(player: Player): void {
        this.frame++
        this.updateDrawRadian(player)
        this.updateSneakProgress(player)
        this.updateDashEffect(player)
        this.updateFlight(player)
    }

    draw(ctx: CanvasRenderingContext2D, player: Player): void {
        ctx.save()
        ctx.globalAlpha = player.isInvincible() ? 0.5 : 1

        this.drawAfterImages(ctx, player)
        this.drawSneakEffect(ctx, player)
        this.drawNormalEffect(ctx, player)
        this.drawDashEffect(ctx, player)
        this.drawActionCooldown(ctx, player)
        this.drawLife(ctx, player)
        this.drawGrazeBoundary(ctx, player)
        this.drawWings(ctx, player)
        this.drawBody(ctx, player)
        this.drawCore(ctx, player)

        ctx.restore()
    }

    // 左右移動に応じてゆっくり回転する角度(スニーク時の多角形の回転に使う)
    updateDrawRadian(player: Player) {
        const input = player.game.input

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

    // ホバリング中の、8の字を描くようなゆるい揺れと、羽音のような細かい震え。横へ動くときは遅れて体をその向きへ向ける
    updateFlight(player: Player) {
        this.hover = vec(
            Math.sin(this.frame / 17) * 1.5 + (Math.random() - 0.5) * 0.6,
            Math.sin(this.frame / 9) * 1.2 + (Math.random() - 0.5) * 0.6,
        )
        // 止まっている間は、あたりを見回すように頭の向きをゆっくり左右に振る
        const stillness = 1 - Math.min(1, player.v.magnitude() / player.slowSpeed)
        // タッチ操作では速度がとても大きくなることがあるので、傾きには上限を付ける
        const target = Math.max(-0.08, Math.min(0.08, player.v.x * 0.01)) + Math.sin(this.frame / 37) * 0.03 * stillness
        this.bank += (target - this.bank) * 0.15
    }

    updateSneakProgress(player: Player) {
        const target = player.game.input.isPressed("slow") ? 1 : 0
        this.sneakProgress += (target - this.sneakProgress) * 0.15
        if (Math.abs(this.sneakProgress - target) < 0.001) this.sneakProgress = target
    }

    // ブースト中は現在地を残像として積み、経時で薄くしながら古いものから消す
    updateDashEffect(player: Player) {
        const isBoosted = player.isBoosted()

        const target = isBoosted ? 1 : 0
        this.dashProgress += (target - this.dashProgress) * 0.35
        if (Math.abs(this.dashProgress - target) < 0.001) this.dashProgress = target

        if (isBoosted) {
            this.afterImages.push({ p: player.p.clone(), alpha: 1.0 })
            if (this.afterImages.length > AFTER_IMAGE_MAX) this.afterImages.shift()
        }

        this.afterImages.forEach((img) => (img.alpha -= AFTER_IMAGE_DECAY))
        while (this.afterImages.length > 0 && this.afterImages[0]!.alpha <= 0) this.afterImages.shift()
    }

    drawSneakEffect(ctx: CanvasRenderingContext2D, player: Player) {
        const ratio = this.sneakProgress
        if (ratio < 0.001) return

        Ctx.arc(ctx, player.p, player.GRAZE_R * EFFECT_SCALE * 3 * ratio, "#ffffff80", { lineWidth: 1 })
        Ctx.arc(ctx, player.p, player.GRAZE_R * EFFECT_SCALE * 2.8 * ratio, "#ffffff80", { lineWidth: 1 })
        Ctx.polygon(ctx, 13, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 2.7 * ratio, "#ffffff80", {
            theta: this.drawRadian / 72,
            lineWidth: 1,
        })
        Ctx.polygon(ctx, 11, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 2 * ratio, "#ffffff80", {
            theta: this.drawRadian / 144,
            lineWidth: 1,
        })
    }

    // 通常時の見た目。スニーク中・ブースト中はその分だけ縮んで消え、解除で元の大きさへ戻る
    drawNormalEffect(ctx: CanvasRenderingContext2D, player: Player) {
        const ratio = Math.max(0, 1 - this.sneakProgress - this.dashProgress)
        if (ratio < 0.001) return

        Ctx.polygon(ctx, 8, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 2.2 * ratio, "#ffffff40", {
            theta: this.drawRadian / 100,
            lineWidth: 1,
        })
    }

    // ブースト中の見た目: 鋭い多角形を二重・三重に重ねて回転させる
    drawDashEffect(ctx: CanvasRenderingContext2D, player: Player) {
        const ratio = this.dashProgress
        if (ratio < 0.001) return

        const r = this.drawRadian
        const cyan = `rgba(80, 220, 255, ${ratio.toFixed(3)})`
        const white = `rgba(255, 255, 255, ${ratio.toFixed(3)})`

        Ctx.polygon(ctx, 3, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 2.8 * ratio, cyan, {
            theta: r / 8,
            lineWidth: 2,
        })
        Ctx.polygon(ctx, 4, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 2.2 * ratio, cyan, {
            theta: -r / 12,
            lineWidth: 2,
        })
        Ctx.polygon(ctx, 3, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 1.6 * ratio, white, {
            theta: -r / 6,
            lineWidth: 1,
        })
        Ctx.polygon(ctx, 4, 2, player.p, player.GRAZE_R * EFFECT_SCALE * 0.9 * ratio, cyan, {
            theta: r / 4,
            lineWidth: 1,
        })
    }

    // actionのクールタイム表示: 明けるまでの残り割合ぶん円弧を伸ばしていく
    drawActionCooldown(ctx: CanvasRenderingContext2D, player: Player) {
        if (player.actionCooldownRemaining <= 0) return

        const progress = T - T * player.actionCooldownRemaining
        Ctx.arc(ctx, player.p, player.GRAZE_R * EFFECT_SCALE, "rgb(255, 255, 127)", {
            lineWidth: 2,
            start: 0,
            end: progress,
        })
    }

    drawAfterImages(ctx: CanvasRenderingContext2D, player: Player) {
        this.afterImages.forEach((img) => {
            const alpha = img.alpha
            if (alpha <= 0) return

            const cyan = `rgba(80, 220, 255, ${(alpha * 0.8).toFixed(3)})`
            const white = `rgba(255, 255, 255, ${(alpha * 0.6).toFixed(3)})`

            Ctx.arc(ctx, img.p, player.r * 3 * EFFECT_SCALE, cyan, { lineWidth: 1 })
            Ctx.polygon(ctx, 3, 2, img.p, player.GRAZE_R * EFFECT_SCALE * 2.2, cyan, {
                theta: this.drawRadian / 8,
                lineWidth: 1,
            })
            Ctx.polygon(ctx, 4, 2, img.p, player.GRAZE_R * EFFECT_SCALE * 1.4, white, {
                theta: -this.drawRadian / 12,
                lineWidth: 2,
            })
        })
    }

    // 上から見た蜂の体。頭を進む向き(上)へ向け、胸の真ん中に当たり判定(赤い点)が来るように描く。
    // 色は使わず、白と黒の濃淡だけで描く。地の色はほぼ黒なので、黒い部分は淡い縁取りで形を見せる。体ごしに弾が見えるよう透かす
    drawBody(ctx: CanvasRenderingContext2D, player: Player) {
        const outline = "rgba(255, 255, 255, 0.6)"

        ctx.save()
        ctx.globalAlpha *= 0.7
        this.toBodySpace(ctx, player)

        // 腹。動きと逆へ少し遅れて振れ、呼吸するようにわずかに伸び縮みする
        ctx.save()
        ctx.translate(0, 5)
        ctx.rotate(Math.sin(this.frame / 10) * 0.012 - this.bank * 0.3)
        ctx.scale(1, 1 + Math.sin(this.frame / 7) * 0.008)

        ctx.beginPath()
        ctx.moveTo(-1.8, 18)
        ctx.lineTo(0, 24)
        ctx.lineTo(1.8, 18)
        ctx.strokeStyle = outline
        ctx.stroke()

        ctx.beginPath()
        ctx.ellipse(0, 8, 7.5, 11, 0, 0, T)

        ctx.save()
        ctx.clip()
        ctx.fillStyle = "#202020"
        for (const y of [4, 9.5, 15]) ctx.fillRect(-8, y, 16, 2.8)
        ctx.restore()
        ctx.strokeStyle = outline
        ctx.stroke()
        ctx.restore()

        // 触角。ときどき小さくぴくりと動かす
        ctx.beginPath()
        for (const side of [-1, 1]) {
            const twitch = Math.sin(this.frame / 13 + side) * 0.4
            ctx.moveTo(side * 1.5, -11)
            ctx.lineTo(side * 3.5, -16)
            ctx.lineTo(side * (7 + twitch), -19 + twitch)
        }
        ctx.strokeStyle = outline
        ctx.stroke()

        // 頭と複眼
        ctx.beginPath()
        ctx.ellipse(0, -10, 5, 3.8, 0, 0, T)
        ctx.strokeStyle = outline
        ctx.stroke()

        ctx.restore()
    }

    drawCore(ctx: CanvasRenderingContext2D, player: Player) {
        Ctx.arc(ctx, player.p, player.r, "red", { lineWidth: 0 })
    }

    drawGrazeBoundary(ctx: CanvasRenderingContext2D, player: Player) {
        Ctx.arc(ctx, player.p, player.GRAZE_R, "#ffffff60", { lineWidth: 2 })
    }

    // 残機は、まわりを回る花粉の部屋(六角形)の数で見せる
    drawLife(ctx: CanvasRenderingContext2D, player: Player) {
        for (let i = 0; i < player.life; i++) {
            const center = player.p.add(
                vec(player.GRAZE_R * EFFECT_SCALE * 3.5, 0).rotate(T * (i / player.maxLife) + this.frame / 60),
            )
            Ctx.polygon(ctx, 6, 1, center, player.GRAZE_R * EFFECT_SCALE, "rgba(229, 180, 80, 0.5)", {
                theta: this.frame / 60,
                lineWidth: 1,
            })
        }
    }

    // 体と翅を描くための座標に移す。(0,0)が胸の真ん中で、頭が上(-y)。
    // 形は小さな座標で描いて、まとめて大きくする。線の太さは拡大後に1pxになるようにする
    toBodySpace(ctx: CanvasRenderingContext2D, player: Player) {
        ctx.translate(player.p.x + this.hover.x, player.p.y + this.hover.y)
        // 横へ動くと、その向きへ少し遅れて体を向ける
        ctx.rotate(this.bank)
        ctx.scale(BODY_SCALE, BODY_SCALE)
        ctx.lineWidth = 1 / BODY_SCALE
    }

    // 蜂の翅は、短い振り幅(およそ90°)をとても速く往復するので、形は見えず、根元から開いた扇のようにぶれて見える。
    // 扇の残像を描き、その中で翅を左右そろえてなめらかに往復させる。
    // 本物の速さで動かすと人の目にはやかましいので、ゆっくり振って見せる。速く飛ぶほど大きく振る
    drawWings(ctx: CanvasRenderingContext2D, player: Player) {
        const power = Math.min(1, player.v.magnitude() / player.speed)
        // 真横を0として、後ろへ回る向きを正にした、翅を振る範囲
        const front = -0.6 - power * 0.25
        const back = 0.95 + power * 0.25

        // 翅は扇の端まではいかせず、少し内側で振り返す
        const angle = (front + back) / 2 + ((back - front) / 2) * 0.8 * Math.sin(this.frame * 0.9)

        ctx.save()
        this.toBodySpace(ctx, player)

        for (const side of [-1, 1]) {
            ctx.save()
            ctx.scale(side, 1)

            // 前翅と後翅は鉤でつながっていて、一緒に動く。後翅は前翅の少し後ろにつく
            for (const [rootY, length, lag, shape, veins] of [
                [-2, 30, 0, WingShape.fore, WingShape.foreVeins],
                [2, 20, 0.15, WingShape.hind, WingShape.hindVeins],
            ] as const) {
                ctx.beginPath()
                ctx.moveTo(2.5, rootY)
                ctx.arc(2.5, rootY, length, front + lag, back + lag)
                ctx.closePath()
                ctx.fillStyle = "rgba(255, 255, 255, 0.06)"
                ctx.fill()

                ctx.save()
                ctx.translate(2.5, rootY)
                ctx.rotate(angle + lag)
                ctx.fillStyle = "rgba(255, 255, 255, 0.08)"
                ctx.fill(shape)
                ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
                ctx.stroke(shape)
                ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"
                ctx.stroke(veins)
                ctx.restore()
            }

            ctx.restore()
        }

        ctx.restore()
    }
}
