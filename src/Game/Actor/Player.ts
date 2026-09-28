import { Actor } from "./Actor"
import { Game } from "../Game"
import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { Remodel, remodel } from "../Remodel"
import { Ease } from "@ipota/functions"
import type { MainEquipment, SubEquipment } from "../Equipment/PlayerEquipment"

// 残像1コマ分のスナップショット
type AfterImage = { p: Vec; alpha: number }

const AFTER_IMAGE_MAX = 12
const AFTER_IMAGE_DECAY = 0.08

const WING_FLAP_INTERVAL = 2

const HIT_SHAKE_INTENSITY = 12
const HIT_SHAKE_FRAME = 60

const [upperWing, lowerWing] = await createWings()

// 上下2枚の羽画像を左右反転で複製し、1枚のcanvasに焼き込んでおく(毎フレームの反転描画コストを避ける)
async function createWings() {
    const upper = new Image()
    upper.src = "assets/image/upper-wing.svg"
    const lower = new Image()
    lower.src = "assets/image/lower-wing.svg"
    await Promise.all([upper.decode(), lower.decode()])

    const upperWingCanvas = document.createElement("canvas")
    upperWingCanvas.width = 512
    upperWingCanvas.height = 64
    const upperWingCtx = upperWingCanvas.getContext("2d")!
    upperWingCtx.drawImage(upper, 256, 0)
    upperWingCtx.scale(-1, 1)
    upperWingCtx.drawImage(upper, -256, 0)

    const lowerWingCanvas = document.createElement("canvas")
    lowerWingCanvas.width = 512
    lowerWingCanvas.height = 128
    const lowerWingCtx = lowerWingCanvas.getContext("2d")!
    lowerWingCtx.drawImage(lower, 256, 0)
    lowerWingCtx.scale(-1, 1)
    lowerWingCtx.drawImage(lower, -256, 0)

    return [upperWingCanvas, lowerWingCanvas] as const
}

// Player自身はセーブデータ(Data層)を知らない。呼び出し側(Scene層)が
// playerDataから読んだ値をここに詰めて渡し、被弾等による変化もonLifeChangeで送り返してもらう
export type PlayerConfig = {
    readonly initialLife: number
    readonly maxLife: number
    readonly mainEquipment: MainEquipment
    readonly subEquipment: SubEquipment | undefined
    readonly onLifeChange: (life: number) => void
}

export class Player extends Actor {
    readonly GRAZE_R = 16

    override readonly r: number = 3

    private readonly maxLife: number
    private frame = 0

    private readonly speed = 8
    private readonly slowSpeed = 3

    // 装備(主にsub装備のaction)が移動速度・無敵状態・クールタイムを一時的に変えるためのフック
    speedMultiplier = 1
    isActionInvincible = false
    // action発動直後が1、クールタイムが明けると0(0の間はクールタイム表示を出さない)
    actionCooldownRemaining = 0

    // 直近フレームの移動速度(羽の傾き等、見た目の計算にのみ使う)
    private v: Vec = vec(0, 0)

    // 低速(スニーク)時の見た目まわり
    private drawRadianVelocity = 0
    private drawRadian = 0
    private sneakProgress = 0 // 0.0〜1.0、低速中に1へ近づく

    // ブースト(ダッシュ等でspeedMultiplierが1を超えた状態)時の見た目まわり
    private dashProgress = 0 // 0.0〜1.0、ブースト中に1へ近づく
    private readonly afterImages: AfterImage[] = []

    private readonly onLifeChange: (life: number) => void

    constructor(game: Game, startPosition: Vec, config: PlayerConfig) {
        super(game)
        this.p = startPosition
        // 残機はステージをまたいで引き継ぐ(値の出所はScene層のplayerData)
        this.life = config.initialLife
        this.maxLife = config.maxLife
        this.onLifeChange = config.onLifeChange

        this.addScript(() => config.mainEquipment.fire(this), { loop: Infinity })
        if (config.subEquipment) this.addScript(() => config.subEquipment!.action(this))
    }

    update(): void {
        super.update()
        this.frame++
        this.move()
        this.updateDrawRadian()
        this.updateSneakProgress()
        this.updateDashEffect()
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save()
        ctx.globalAlpha = this.isInvincible() ? 0.5 : 1

        this.drawAfterImages(ctx)
        this.drawSneakEffect(ctx)
        this.drawNormalEffect(ctx)
        this.drawDashEffect(ctx)
        this.drawActionCooldown(ctx)
        this.drawLife(ctx)
        this.drawGrazeBoundary(ctx)
        this.drawCore(ctx)
        this.drawWings(ctx)

        ctx.restore()
    }

    isInvincible() {
        return this.scripts.has("invincible") || this.isActionInvincible
    }

    // 被弾処理: ライフを減らし、しばらく無敵にする
    hit(damage: number) {
        if (this.isInvincible()) return

        this.life = Math.max(-1, this.life - damage)
        this.onLifeChange(this.life)
        this.game.camera.shake(HIT_SHAKE_INTENSITY, HIT_SHAKE_FRAME)

        this.addScript(
            function* () {
                const invincibleFrame = 120
                yield* Array(invincibleFrame)
            },
            { id: "invincible" },
        )

        if (this.life < 0) {
            this.game.lose()
            this.addScript(() => this.explode(), { id: "explode" })
        } else {
            this.addScript(() => this.hitField(), { id: "hitField" })
        }
    }

    // 自爆: 無敵時間に関係なく強制的にゲームオーバーにする。被弾と同じ弾処理リングは出す
    selfDestruct() {
        this.life = Math.max(-1, this.life - 1)
        this.onLifeChange(this.life)

        this.game.camera.shake(HIT_SHAKE_INTENSITY, HIT_SHAKE_FRAME)

        this.addScript(() => this.explode(), { id: "explode" })
        this.game.lose()
    }

    // 自爆時に三角形の破片を撒き散らす。当たり判定を持たないeffect弾として実装
    private *explode() {
        yield* remodel(this)
            .p(this.p.clone())
            .type("effect")
            .appearance("triangle")
            .color("white")
            .alpha(0.5)
            .duplicate(16, (b) => {
                b.r = Math.random() * 8 + 8
                b.speed = Math.random() * 2 + 2
                b.radian = Math.random() * T
                return b
            })
            .g((me) => Remodel.fadeout(me, 60))
            .fire(this.game.bullets)
    }

    // 被弾した瞬間に自機を中心としたリングを広げ、触れた敵弾をスコアに変える。
    // 無敵時間と同じくaddScript任せで進行させ、見た目もこの中で完結させて描いてしまう
    // (Playerに専用フィールドを持たせない)
    private *hitField() {
        const frame = 60
        const center = this.p.clone()
        const ctx = this.game.ctx

        for (let i = 1; i < frame + 1; i++) {
            const radius = Ease.Out(i / frame) * this.game.WIDTH
            const alpha = 1 - i / frame

            this.game.bullets
                .filter((b) => b.type === "enemy")
                .filter((b) => b.isScorable)
                .filter((b) => b.p.sub(center).magnitude() <= radius)
                .forEach((b) => b.scorenize())

            ctx.save()
            this.game.camera.apply(ctx, this.game.WIDTH, this.game.HEIGHT)
            Ctx.arc(ctx, center, radius, `rgba(255, 255, 255, ${alpha})`, { lineWidth: 2 })
            ctx.restore()

            yield
        }
    }

    private move() {
        // ゲームオーバー後は爆発演出だけ進めればよく、移動もパーティクルも出さない
        if (this.game.isGameOver) return

        const input = this.game.input

        // タッチドラッグ中は、指の移動量(ワールド座標のベクトル)をそのまま速度として使う
        const touchMoveVector = input.getTouchMoveVector?.()

        if (touchMoveVector) {
            this.v = touchMoveVector
        } else {
            const dir = vec(
                (input.isPressed("right") ? 1 : 0) - (input.isPressed("left") ? 1 : 0),
                (input.isPressed("down") ? 1 : 0) - (input.isPressed("up") ? 1 : 0),
            )
            this.v =
                dir.magnitude() === 0
                    ? vec(0, 0)
                    : dir
                          .normalize()
                          .scale((input.isPressed("slow") ? this.slowSpeed : this.speed) * this.speedMultiplier)
        }

        if (this.v.magnitude() === 0) return

        const next = this.p.add(this.v)

        this.p = vec(Math.min(Math.max(next.x, 0), this.game.WIDTH), Math.min(Math.max(next.y, 0), this.game.HEIGHT))

        this.emitMoveParticles()
    }

    // 移動中に周りへ撒き散らす、縮小しながら消えていく三角形の粒子。ブースト中はより多く・長く残す
    private emitMoveParticles() {
        const isBoosted = this.speedMultiplier > 1
        const count = isBoosted ? 2 : 1

        for (let i = 0; i < count; i++) {
            this.addScript(() => this.moveParticle(isBoosted))
        }
    }

    private *moveParticle(isBoosted: boolean) {
        const maxFrame = isBoosted ? 30 : 20
        const speed = isBoosted ? 8 : 4

        const offset = vec((Math.random() - 0.5) * this.GRAZE_R * 16, (Math.random() - 0.5) * this.GRAZE_R * 4)
        let p = this.p.add(offset)
        let v = vec((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed)

        const size = Math.random() * 2 + 3
        let angle = Math.random() * T
        const angularVelocity = (Math.random() - 0.5) * 0.1

        const ctx = this.game.ctx

        for (let i = 0; i < maxFrame; i++) {
            const alpha = (1 - i / maxFrame) * 0.15

            ctx.save()
            this.game.camera.apply(ctx, this.game.WIDTH, this.game.HEIGHT)
            ctx.globalAlpha = alpha
            Ctx.polygon(ctx, 3, 1, p, size, "#e0e0e0", { theta: angle })
            ctx.restore()

            p = p.add(v)
            v = v.scale(0.96)
            angle += angularVelocity

            yield
        }
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

    // ブースト中は現在地を残像として積み、経時で薄くしながら古いものから消す
    private updateDashEffect() {
        const isBoosted = this.speedMultiplier > 1

        const target = isBoosted ? 1 : 0
        this.dashProgress += (target - this.dashProgress) * 0.35
        if (Math.abs(this.dashProgress - target) < 0.001) this.dashProgress = target

        if (isBoosted) {
            this.afterImages.push({ p: this.p.clone(), alpha: 1.0 })
            if (this.afterImages.length > AFTER_IMAGE_MAX) this.afterImages.shift()
        }

        this.afterImages.forEach((img) => (img.alpha -= AFTER_IMAGE_DECAY))
        while (this.afterImages.length > 0 && this.afterImages[0]!.alpha <= 0) this.afterImages.shift()
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

    // 通常時の見た目。スニーク中・ブースト中はその分だけ縮んで消え、解除で元の大きさへ戻る
    private drawNormalEffect(ctx: CanvasRenderingContext2D) {
        const ratio = Math.max(0, 1 - this.sneakProgress - this.dashProgress)
        if (ratio < 0.001) return

        Ctx.polygon(ctx, 8, 2, this.p, this.GRAZE_R * 2.2 * ratio, "#ffffff40", {
            theta: this.drawRadian / 100,
            lineWidth: 1,
        })
    }

    // ブースト中の見た目: 鋭い多角形を二重・三重に重ねて回転させる
    private drawDashEffect(ctx: CanvasRenderingContext2D) {
        const ratio = this.dashProgress
        if (ratio < 0.001) return

        const r = this.drawRadian
        const cyan = `rgba(80, 220, 255, ${ratio.toFixed(3)})`
        const white = `rgba(255, 255, 255, ${ratio.toFixed(3)})`

        Ctx.polygon(ctx, 3, 2, this.p, this.GRAZE_R * 2.8 * ratio, cyan, { theta: r / 8, lineWidth: 2 })
        Ctx.polygon(ctx, 4, 2, this.p, this.GRAZE_R * 2.2 * ratio, cyan, { theta: -r / 12, lineWidth: 2 })
        Ctx.polygon(ctx, 3, 2, this.p, this.GRAZE_R * 1.6 * ratio, white, { theta: -r / 6, lineWidth: 1 })
        Ctx.polygon(ctx, 4, 2, this.p, this.GRAZE_R * 0.9 * ratio, cyan, { theta: r / 4, lineWidth: 1 })
    }

    // actionのクールタイム表示: 明けるまでの残り割合ぶん円弧を伸ばしていく
    private drawActionCooldown(ctx: CanvasRenderingContext2D) {
        if (this.actionCooldownRemaining <= 0) return

        const progress = T - T * this.actionCooldownRemaining
        Ctx.arc(ctx, this.p, this.GRAZE_R / 2, "rgb(255, 255, 127)", { lineWidth: 2, start: 0, end: progress })
    }

    private drawAfterImages(ctx: CanvasRenderingContext2D) {
        const total = this.afterImages.length

        this.afterImages.forEach((img, i) => {
            const ratio = (i + 1) / total
            const alpha = img.alpha * ratio
            if (alpha <= 0) return

            const color = `rgba(80, 220, 255, ${alpha.toFixed(3)})`

            Ctx.arc(ctx, img.p, this.r * ratio, color, { lineWidth: 0 })
            Ctx.polygon(ctx, 3, 2, img.p, this.GRAZE_R * 1.8 * ratio, color, {
                theta: this.drawRadian / 8,
                lineWidth: 1,
            })
            Ctx.polygon(ctx, 4, 2, img.p, this.GRAZE_R * 1.2 * ratio, color, {
                theta: -this.drawRadian / 12,
                lineWidth: 1,
            })
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

    // 上下2枚の羽をWING_FLAP_INTERVALフレームごとに交互に切り替えて羽ばたきに見せる
    private drawWings(ctx: CanvasRenderingContext2D) {
        const isUpperFrame = Math.floor(this.frame / WING_FLAP_INTERVAL) % 2 === 0
        const phase = isUpperFrame ? 1 : -1
        const offsetY = phase * 3
        const scaleY = 1 + phase * 0.08

        ctx.save()
        ctx.translate(this.p.x, this.p.y + offsetY)
        ctx.scale(1, scaleY)
        ctx.globalAlpha = 0.6
        ctx.rotate((this.v.x / 20) * T * 0.02)
        ctx.translate(-256, -40)

        ctx.drawImage(isUpperFrame ? upperWing : lowerWing, Math.random() - 0.5, Math.random() - 0.5)

        ctx.restore()
    }
}
