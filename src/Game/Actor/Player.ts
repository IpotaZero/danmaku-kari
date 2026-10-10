import { Actor } from "./Actor"
import { Game } from "../Game"
import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { Behavior, remodel } from "../Remodel"
import { Ease } from "@ipota/functions"
import type { MainEquipment, SubEquipment } from "../Equipment/PlayerEquipment"

// 残像1コマ分のスナップショット
type AfterImage = { p: Vec; alpha: number }

const AFTER_IMAGE_MAX = 18
const AFTER_IMAGE_DECAY = 0.05

// 蜂の体(翅を含む)と、そのまわりの多角形・円の大きさの倍率(当たり判定・かすり判定の大きさは変えない)
const BODY_SCALE = 2.24
const EFFECT_SCALE = 1.44

const HIT_SHAKE_INTENSITY = 12
const HIT_SHAKE_FRAME = 60

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
    readonly GRAZE_R = 20

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

    // 蜂らしい飛び方の見た目まわり。体と翅は、当たり判定(this.p)からhoverだけずらして描く
    private hover: Vec = vec(0, 0)
    // 横への傾き。速度にすぐには追いつかず、遅れて傾く
    private bank = 0

    // 低速(スニーク)時の見た目まわり
    private drawRadianVelocity = 0
    private drawRadian = 0
    private sneakProgress = 0 // 0.0〜1.0、低速中に1へ近づく

    // ブースト(ダッシュ等でspeedMultiplierが1を超えた状態)時の見た目まわり
    private dashProgress = 0 // 0.0〜1.0、ブースト中に1へ近づく
    private readonly afterImages: AfterImage[] = []

    private readonly onLifeChange: (life: number) => void

    private readonly equipments: readonly (MainEquipment | SubEquipment)[]

    constructor(game: Game, startPosition: Vec, config: PlayerConfig) {
        super(game)
        this.p = startPosition
        // 残機はステージをまたいで引き継ぐ(値の出所はScene層のplayerData)
        this.life = config.initialLife
        this.maxLife = config.maxLife
        this.onLifeChange = config.onLifeChange
        this.equipments = [config.mainEquipment, ...(config.subEquipment ? [config.subEquipment] : [])]

        this.addScript(() => config.mainEquipment.fire(this), { loop: Infinity })
        if (config.subEquipment) this.addScript(() => config.subEquipment!.action(this))
    }

    // ステージの会話を装備で分岐させるためのもの。例: this.game.player.isEquipped(laser)
    isEquipped(equipment: MainEquipment | SubEquipment): boolean {
        return this.equipments.includes(equipment)
    }

    update(): void {
        super.update()
        this.frame++
        this.move()
        this.updateDrawRadian()
        this.updateSneakProgress()
        this.updateDashEffect()
        this.updateFlight()
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
        this.drawWings(ctx)
        this.drawBody(ctx)
        this.drawCore(ctx)

        ctx.restore()
    }

    isInvincible() {
        return this.scripts.has("invincible") || this.isActionInvincible
    }

    // ダッシュ等でspeedMultiplierが1を超えている状態
    private isBoosted() {
        return this.speedMultiplier > 1
    }

    // 被弾処理: ライフを減らし、しばらく無敵にする
    hit(damage: number) {
        if (this.isInvincible()) return

        this.life = Math.max(-1, this.life - damage)
        this.onLifeChange(this.life)
        this.game.se.hit.play()
        this.game.se.u.play()
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

        this.game.se.hit.play()
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
            .g((me) => Behavior.fadeout(me, 60))
            .fire(this.game.bullets)
    }

    // 被弾した瞬間に自機を中心としたリングを広げ、触れた敵弾をスコアに変える。
    // このスコアは自機へ寄ってこず落ちていくので、拾うには取りに行く必要がある。
    // 無敵時間と同じくaddScript任せで進行させ、見た目もこの中で完結させて描いてしまう
    // (Playerに専用フィールドを持たせない)
    private *hitField() {
        const frame = 60
        const center = this.p.clone()

        for (let i = 1; i < frame + 1; i++) {
            const radius = Ease.Out(i / frame) * this.game.WIDTH
            const alpha = 1 - i / frame

            this.game.bullets
                .filter((b) => b.type === "enemy")
                .filter((b) => b.isScorable)
                .filter((b) => b.p.sub(center).magnitude() <= radius)
                .forEach((b) => b.scorenizeToFall())

            this.game.drawInWorld((ctx) =>
                Ctx.arc(ctx, center, radius, `rgba(255, 255, 255, ${alpha})`, { lineWidth: 2 }),
            )

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
                    : dir.normalize().scale(
                          // ブースト中は低速入力を無視し、通常速度を基準に加速する
                          (input.isPressed("slow") && !this.isBoosted() ? this.slowSpeed : this.speed) *
                              this.speedMultiplier,
                      )
        }

        if (this.v.magnitude() === 0) return

        this.drag(this.v)

        this.emitMoveParticles()
    }

    // 自機を v だけ動かす。ステージの吸い込みや流れからも呼ばれる。画面の外へは出さない
    drag(v: Vec) {
        const next = this.p.add(v)

        this.p = vec(Math.min(Math.max(next.x, 0), this.game.WIDTH), Math.min(Math.max(next.y, 0), this.game.HEIGHT))
    }

    // 移動中に周りへ撒き散らす、縮小しながら消えていく三角形の粒子。ブースト中はより多く・長く残す
    private emitMoveParticles() {
        const isBoosted = this.isBoosted()
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

        for (let i = 0; i < maxFrame; i++) {
            const alpha = (1 - i / maxFrame) * 0.15
            // 描画はyield後のdraw()で行われるので、この後書き換わるp/angleはここで固定しておく
            const drawP = p
            const drawAngle = angle

            this.game.drawInWorld((ctx) => {
                ctx.globalAlpha = alpha
                Ctx.polygon(ctx, 3, 1, drawP, size, "#e0e0e0", { theta: drawAngle })
            })

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

    // ホバリング中の、8の字を描くようなゆるい揺れと、羽音のような細かい震え。横へ動くときは遅れて体をその向きへ向ける
    private updateFlight() {
        this.hover = vec(
            Math.sin(this.frame / 17) * 1.5 + (Math.random() - 0.5) * 0.6,
            Math.sin(this.frame / 9) * 1.2 + (Math.random() - 0.5) * 0.6,
        )
        // 止まっている間は、あたりを見回すように頭の向きをゆっくり左右に振る
        const stillness = 1 - Math.min(1, this.v.magnitude() / this.slowSpeed)
        // タッチ操作では速度がとても大きくなることがあるので、傾きには上限を付ける
        const target = Math.max(-0.08, Math.min(0.08, this.v.x * 0.01)) + Math.sin(this.frame / 37) * 0.03 * stillness
        this.bank += (target - this.bank) * 0.15
    }

    private updateSneakProgress() {
        const target = this.game.input.isPressed("slow") ? 1 : 0
        this.sneakProgress += (target - this.sneakProgress) * 0.15
        if (Math.abs(this.sneakProgress - target) < 0.001) this.sneakProgress = target
    }

    // ブースト中は現在地を残像として積み、経時で薄くしながら古いものから消す
    private updateDashEffect() {
        const isBoosted = this.isBoosted()

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

        Ctx.arc(ctx, this.p, this.GRAZE_R * EFFECT_SCALE * 3 * ratio, "#ffffff80", { lineWidth: 1 })
        Ctx.arc(ctx, this.p, this.GRAZE_R * EFFECT_SCALE * 2.8 * ratio, "#ffffff80", { lineWidth: 1 })
        Ctx.polygon(ctx, 13, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 2.7 * ratio, "#ffffff80", {
            theta: this.drawRadian / 72,
            lineWidth: 1,
        })
        Ctx.polygon(ctx, 11, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 2 * ratio, "#ffffff80", {
            theta: this.drawRadian / 144,
            lineWidth: 1,
        })
    }

    // 通常時の見た目。スニーク中・ブースト中はその分だけ縮んで消え、解除で元の大きさへ戻る
    private drawNormalEffect(ctx: CanvasRenderingContext2D) {
        const ratio = Math.max(0, 1 - this.sneakProgress - this.dashProgress)
        if (ratio < 0.001) return

        Ctx.polygon(ctx, 8, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 2.2 * ratio, "#ffffff40", {
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

        Ctx.polygon(ctx, 3, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 2.8 * ratio, cyan, { theta: r / 8, lineWidth: 2 })
        Ctx.polygon(ctx, 4, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 2.2 * ratio, cyan, {
            theta: -r / 12,
            lineWidth: 2,
        })
        Ctx.polygon(ctx, 3, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 1.6 * ratio, white, {
            theta: -r / 6,
            lineWidth: 1,
        })
        Ctx.polygon(ctx, 4, 2, this.p, this.GRAZE_R * EFFECT_SCALE * 0.9 * ratio, cyan, { theta: r / 4, lineWidth: 1 })
    }

    // actionのクールタイム表示: 明けるまでの残り割合ぶん円弧を伸ばしていく
    private drawActionCooldown(ctx: CanvasRenderingContext2D) {
        if (this.actionCooldownRemaining <= 0) return

        const progress = T - T * this.actionCooldownRemaining
        Ctx.arc(ctx, this.p, this.GRAZE_R * EFFECT_SCALE, "rgb(255, 255, 127)", {
            lineWidth: 2,
            start: 0,
            end: progress,
        })
    }

    private drawAfterImages(ctx: CanvasRenderingContext2D) {
        this.afterImages.forEach((img) => {
            const alpha = img.alpha
            if (alpha <= 0) return

            const cyan = `rgba(80, 220, 255, ${(alpha * 0.8).toFixed(3)})`
            const white = `rgba(255, 255, 255, ${(alpha * 0.6).toFixed(3)})`

            Ctx.arc(ctx, img.p, this.r * 3 * EFFECT_SCALE, cyan, { lineWidth: 1 })
            Ctx.polygon(ctx, 3, 2, img.p, this.GRAZE_R * EFFECT_SCALE * 2.2, cyan, {
                theta: this.drawRadian / 8,
                lineWidth: 1,
            })
            Ctx.polygon(ctx, 4, 2, img.p, this.GRAZE_R * EFFECT_SCALE * 1.4, white, {
                theta: -this.drawRadian / 12,
                lineWidth: 2,
            })
        })
    }

    // 上から見た蜂の体。頭を進む向き(上)へ向け、胸の真ん中に当たり判定(赤い点)が来るように描く。
    // 色は使わず、白と黒の濃淡だけで描く。地の色はほぼ黒なので、黒い部分は淡い縁取りで形を見せる。体ごしに弾が見えるよう透かす
    private drawBody(ctx: CanvasRenderingContext2D) {
        const outline = "rgba(255, 255, 255, 0.6)"

        ctx.save()
        ctx.globalAlpha *= 0.7
        this.toBodySpace(ctx)

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

    private drawCore(ctx: CanvasRenderingContext2D) {
        Ctx.arc(ctx, this.p, this.r, "red", { lineWidth: 0 })
    }

    private drawGrazeBoundary(ctx: CanvasRenderingContext2D) {
        Ctx.arc(ctx, this.p, this.GRAZE_R, "#ffffff60", { lineWidth: 2 })
    }

    // 残機は、まわりを回る花粉の部屋(六角形)の数で見せる
    private drawLife(ctx: CanvasRenderingContext2D) {
        for (let i = 0; i < this.life; i++) {
            const center = this.p.add(
                vec(this.GRAZE_R * EFFECT_SCALE * 3.5, 0).rotate(T * (i / this.maxLife) + this.frame / 60),
            )
            Ctx.polygon(ctx, 6, 1, center, this.GRAZE_R * EFFECT_SCALE, "rgba(229, 180, 80, 0.5)", {
                theta: this.frame / 60,
                lineWidth: 1,
            })
        }
    }

    // 体と翅を描くための座標に移す。(0,0)が胸の真ん中で、頭が上(-y)。
    // 形は小さな座標で描いて、まとめて大きくする。線の太さは拡大後に1pxになるようにする
    private toBodySpace(ctx: CanvasRenderingContext2D) {
        ctx.translate(this.p.x + this.hover.x, this.p.y + this.hover.y)
        // 横へ動くと、その向きへ少し遅れて体を向ける
        ctx.rotate(this.bank)
        ctx.scale(BODY_SCALE, BODY_SCALE)
        ctx.lineWidth = 1 / BODY_SCALE
    }

    // 蜂の翅は、短い振り幅(およそ90°)をとても速く往復するので、形は見えず、根元から開いた扇のようにぶれて見える。
    // 扇の残像を描き、その中で翅を左右そろえてなめらかに往復させる。
    // 本物の速さで動かすと人の目にはやかましいので、ゆっくり振って見せる。速く飛ぶほど大きく振る
    private drawWings(ctx: CanvasRenderingContext2D) {
        const power = Math.min(1, this.v.magnitude() / this.speed)
        // 真横を0として、後ろへ回る向きを正にした、翅を振る範囲
        const front = -0.6 - power * 0.25
        const back = 0.95 + power * 0.25

        // 翅は扇の端まではいかせず、少し内側で振り返す
        const angle = (front + back) / 2 + ((back - front) / 2) * 0.8 * Math.sin(this.frame * 0.9)

        ctx.save()
        this.toBodySpace(ctx)

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
