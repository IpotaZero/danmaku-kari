import { Camera } from "./Actor/Camera"
import { DigitalInput } from "@ipota/input"
import { Vec, vec } from "@ipota/vec"
import { Player } from "./Actor/Player"
import { Enemy } from "./Actor/Enemy"
import { Bullet } from "./Actor/Bullet"
import { BulletDrawer } from "./BulletDrawer"
import { BulletCollision } from "./BulletCollision"
import { IteratorQueue } from "./IteratorQueue"
import { Stage } from "../Stage/Stage"
import { TextBox } from "../utils/TextBox"

/**
 * ゲーム本体をカプセル化したクラス。
 */
export class Game extends IteratorQueue {
    readonly canvas: HTMLCanvasElement
    readonly ctx: CanvasRenderingContext2D

    readonly stage: Stage

    readonly player: Player
    readonly camera: Camera

    enemies: Enemy[] = []
    bullets: Bullet[] = []

    readonly textBox: TextBox

    private state: "playing" | "game-over" | "cleared" = "playing"

    private score = 0

    private bulletDrawer = new BulletDrawer()
    private bulletCollision = new BulletCollision()

    readonly WIDTH = 32 * 18
    readonly HEIGHT = 32 * 24

    constructor(
        stage: (game: Game) => Stage,
        readonly input: DigitalInput.Reader<"right" | "left" | "up" | "down" | "slow" | "ok" | "cancel">,
        readonly onWin: () => void,
        readonly onLose: () => void,
    ) {
        super()

        this.stage = stage(this)

        this.canvas = document.createElement("canvas")
        this.canvas.width = this.WIDTH
        this.canvas.height = this.HEIGHT

        const ctx = this.canvas.getContext("2d")
        if (!ctx) throw new Error("2D context is not available")
        this.ctx = ctx
        this.ctx.globalCompositeOperation = "lighter"

        this.textBox = new TextBox(this.input, () => {})

        this.player = new Player(this, vec(this.WIDTH / 2, this.HEIGHT / 2))
        this.camera = new Camera(this, this.player.p)
    }

    update(): void {
        this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT)

        this.stage.update()
        this.updateBulletAndEnemy()
        this.updatePlayer()
        this.updateCamera()

        if (this.stage.isCleared) this.win()

        this.draw()
        super.update()
    }

    // ステージクリア。何度呼ばれてもonWinは1度だけ発火する
    win() {
        this.state = "cleared"
        this.onWin()
    }

    // ゲームオーバー。何度呼ばれてもonLoseは1度だけ発火する
    lose() {
        this.state = "game-over"
        this.onLose()
    }

    private updateBulletAndEnemy() {
        if (!this.player.isInvincible() && this.state === "playing") {
            this.bullets
                .filter((b) => b.type === "enemy")
                .forEach((b) => {
                    if (this.bulletCollision.isColliding(b, this.player)) {
                        this.player.hit(b.damage)

                        if (b.isScorable) {
                            b.life = 0
                        }
                    }
                })
        }

        this.bullets
            .filter((b) => b.type === "score")
            .forEach((b) => {
                if (this.bulletCollision.isColliding(b, this.player)) {
                    this.score++
                    b.life = 0
                }
            })

        this.bullets
            .filter((b) => b.type === "friend")
            .forEach((b) => {
                this.enemies.forEach((e) => {
                    if (e.isInvincible) return

                    if (this.bulletCollision.isColliding(b, e)) {
                        b.life = 0

                        e.life -= b.damage
                        e.hit()
                    }
                })
            })

        this.bullets.forEach((b) => b.update())
        this.enemies.forEach((e) => e.update())

        const aliveBullets = this.bullets.filter((b) => b.life > 0)
        this.bullets.length = 0
        this.bullets.push(...aliveBullets)

        const aliveEnemies = this.enemies.filter((e) => {
            if (e.life <= 0) {
                this.addScript(() => e.onDead())
            }

            return e.life > 0
        })
        this.enemies.length = 0
        this.enemies.push(...aliveEnemies)
    }

    private updatePlayer(): void {
        this.player.update()
    }

    private updateCamera(): void {
        this.camera.update()
    }

    private draw(): void {
        const ctx = this.ctx

        ctx.save()
        this.camera.apply(ctx, this.WIDTH, this.HEIGHT)
        this.bullets.forEach((b) => this.bulletDrawer.draw(b, ctx))
        ctx.restore()

        // GPUでまとめて描いた弾は、カメラ変換込みの画面座標で焼き込まれているため
        // ctxのtransformを掛けていない状態（Camera.apply()の外）で合成する
        this.bulletDrawer.flush(ctx, this.camera.getTransform(), this.WIDTH, this.HEIGHT)

        ctx.save()
        this.camera.apply(ctx, this.WIDTH, this.HEIGHT)
        this.enemies.forEach((e) => e.draw(ctx))
        if (this.state !== "game-over") this.player.draw(ctx)
        ctx.restore()
    }
}
