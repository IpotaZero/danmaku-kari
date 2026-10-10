import { Actor } from "./Actor"
import { Game } from "../Game"
import { vec, Vec } from "@ipota/vec"
import { T } from "../../T"
import { Ctx } from "../../utils/Functions/Ctx"
import { Behavior, remodel } from "../Remodel"
import { Ease } from "@ipota/functions"
import type { MainEquipment, SubEquipment } from "../Equipment/PlayerEquipment"
import { PlayerRenderer } from "./PlayerRenderer"

const HIT_SHAKE_INTENSITY = 12
const HIT_SHAKE_FRAME = 60

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

    readonly maxLife: number
    readonly speed = 8
    readonly slowSpeed = 3

    // 装備(主にsub装備のaction)が移動速度・無敵状態・クールタイムを一時的に変えるためのフック
    // ブースト中の速さ(定値)。ブースト中でなければundefined
    boostSpeed: number | undefined
    isActionInvincible = false
    // action発動直後が1、クールタイムが明けると0(0の間はクールタイム表示を出さない)
    actionCooldownRemaining = 0

    // 直近フレームの移動速度(羽の傾き等、見た目の計算にのみ使う。PlayerRendererが読む)
    v: Vec = vec(0, 0)

    readonly renderer = new PlayerRenderer()

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
        this.move()
        this.renderer.update(this)
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this.renderer.draw(ctx, this)
    }

    isInvincible() {
        return this.scripts.has("invincible") || this.isActionInvincible
    }

    // ダッシュ等でboostSpeedが設定されている状態
    isBoosted() {
        return this.boostSpeed !== undefined
    }

    // 被弾処理: ライフを減らし、しばらく無敵にする
    hit(damage: number) {
        if (this.isInvincible()) return

        this.life = Math.max(-1, this.life - damage)
        this.onLifeChange(this.life)
        this.game.se.hit.play()
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

            // 毎フレーム全弾を見るので、filterで配列を作らずに一度で振り分ける(GC対策)
            this.game.bullets.forEach((b) => {
                if (b.type !== "enemy" || !b.isScorable) return
                if ((b.p.x - center.x) ** 2 + (b.p.y - center.y) ** 2 > radius ** 2) return

                b.scorenizeToFall()
            })

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
            // スティックの倒し具合をそのまま速さにする。キーボードの斜めやスティックの角は長さが1を超えるので1に抑える
            const dir = vec(
                input.getValue("right") - input.getValue("left"),
                input.getValue("down") - input.getValue("up"),
            )
            if (dir.magnitude() === 0) {
                this.v = vec(0, 0)
            } else if (this.boostSpeed !== undefined) {
                // ブースト中は倒し具合も低速入力も無視し、向きだけ使って定値の速さで動く
                this.v = dir.normalize().scale(this.boostSpeed)
            } else {
                this.v = (dir.magnitude() > 1 ? dir.normalize() : dir).scale(
                    input.isPressed("slow") ? this.slowSpeed : this.speed,
                )
            }
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
}
