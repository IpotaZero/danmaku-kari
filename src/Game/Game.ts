import { Camera } from "./Actor/Camera"
import { DigitalInput } from "@ipota/input"
import { Vec, vec } from "@ipota/vec"
import { Player, PlayerConfig } from "./Actor/Player"
import { Enemy } from "./Actor/Enemy"
import { Bullet } from "./Actor/Bullet"
import { BulletDrawer } from "./BulletDrawer"
import { BulletCollision } from "./BulletCollision"
import { IteratorQueue } from "./IteratorQueue"
import { Stage } from "../Stage/Stage"
import { TextBox } from "../utils/TextBox"
import { FigureLayer } from "../utils/FigureLayer"
import { TouchControls } from "./TouchControls"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Dom } from "../Dom"

export type GameAction = "right" | "left" | "up" | "down" | "slow" | "suicide" | "action" | "ok" | "cancel"

// タッチドラッグ時、方向キーの代わりに移動量(ワールド座標のベクトル)を直接渡すための拡張。
// TouchControls以外(キーボード/ゲームパッド)は実装しないため、未実装を許すoptionalにしている
export type GameInput = DigitalInput.Reader<GameAction> & {
    getTouchMoveVector?(): Vec | undefined
}

// ゲーム中に鳴らすSE。App.seをそのまま渡せるよう、play()できることだけを要求する
export type GameSE = Record<
    "graze" | "hit" | "dash" | "u" | "crush" | "bossDefeatPre" | "bossDefeat" | "charge" | "gameover",
    { play(): void }
>

export type GameConfig = {
    createStage: (game: Game) => Promise<Stage>
    input: DigitalInput.Reader<GameAction>
    se: GameSE
    onWin: () => void
    onLose: (score: number) => void
    onScoreCollected: (score: number) => void
    playerConfig: PlayerConfig
}

/**
 * ゲーム本体をカプセル化したクラス。
 */
export class Game extends IteratorQueue {
    readonly canvas: HTMLCanvasElement
    readonly ctx: CanvasRenderingContext2D

    stage!: Stage
    readonly player: Player
    readonly camera: Camera

    enemies: Enemy[] = []
    bullets: Bullet[] = []

    readonly textBox: TextBox
    readonly figureLayer = new FigureLayer()
    readonly input: GameInput
    readonly se: GameSE

    private readonly touchControls: TouchControls

    private state: "playing" | "game-over" | "cleared" = "playing"

    get isPlaying(): boolean {
        return this.state === "playing"
    }

    // クリア後の演出中も含め、ゲームオーバーでない限り攻撃を続けさせるためのフラグ
    get isGameOver(): boolean {
        return this.state === "game-over"
    }

    private score = 0

    private bulletDrawer = new BulletDrawer()
    private bulletCollision = new BulletCollision()

    readonly WIDTH = 32 * 16
    // 画面回転やスマホのアドレスバー表示/非表示で画面比が変わった際、resizeCanvas()が更新する
    HEIGHT: number

    // window.innerWidth/innerHeightはスマホのアドレスバー分の食い違いで実際の表示サイズ(dvh基準)と
    // ずれることがあるため、キャンバスが実際に収まる#containerのサイズを直接観測する
    private readonly resizeObserver = new ResizeObserver(() => this.resizeCanvas())

    private readonly onWin: () => void
    private readonly onLose: (score: number) => void
    private readonly onScoreCollected: (score: number) => void

    private constructor({ input, se, onWin, onLose, onScoreCollected, playerConfig }: GameConfig) {
        super()

        this.se = se
        this.onWin = onWin
        this.onLose = onLose
        this.onScoreCollected = onScoreCollected

        this.HEIGHT = this.computeHeight()

        this.canvas = document.createElement("canvas")
        this.canvas.width = this.WIDTH
        this.canvas.height = this.HEIGHT
        if (isSmartPhone) this.canvas.classList.add("smartphone")

        const ctx = this.canvas.getContext("2d")
        if (!ctx) throw new Error("2D context is not available")
        this.ctx = ctx
        this.ctx.globalCompositeOperation = "lighter"

        this.resizeObserver.observe(Dom.container)

        this.touchControls = new TouchControls(input, this.canvas)
        this.input = this.touchControls

        this.textBox = new TextBox(this.input, () => {})

        this.player = new Player(this, vec(this.WIDTH / 2, this.HEIGHT / 2), playerConfig)
        this.camera = new Camera(this, this.player.p)
    }

    static async create(config: GameConfig): Promise<Game> {
        const game = new Game(config)
        game.stage = await config.createStage(game)
        return game
    }

    // 画面比に合わせてフィールドの高さを決める。ただしwidth:heightが1:2より横長にはしない
    // (縦長のスマホ画面ではそのまま画面比に追従させる。横長のPC画面ではフィールドが
    // 潰れて遊べなくなるのを防ぐため、常に最低でも縦長2倍(1:2)の比を保つ)
    private computeHeight(): number {
        const minWidthToHeightRatio = 1 / 2
        const viewportAspect = Dom.container.clientWidth / Dom.container.clientHeight
        return Math.round(this.WIDTH / Math.min(viewportAspect, minWidthToHeightRatio))
    }

    private resizeCanvas() {
        const height = this.computeHeight()
        if (height === this.HEIGHT) return

        this.HEIGHT = height
        // canvasの幅/高さ属性への代入はキャンバスの内容と描画状態を初期化するため、都度張り直す
        this.canvas.height = this.HEIGHT
        this.ctx.globalCompositeOperation = "lighter"
    }

    dispose() {
        this.resizeObserver.disconnect()
        this.figureLayer.dispose()
    }

    update(): void {
        this.touchControls.update()

        if (this.state === "playing" && this.input.isPushed("suicide")) {
            this.player.selfDestruct()
        }

        this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT)

        this.stage.update()
        this.updateBulletAndEnemy()

        this.updatePlayer()

        this.updateCamera()

        if (this.stage.isCleared) this.win()

        this.draw()
        this.stage.drawOverlay(this.ctx, this.WIDTH, this.HEIGHT)
        super.update()
    }

    // ステージクリア。何度呼ばれてもonWinは1度だけ発火する。
    // スコア化した弾の回収(waitScoreCollected)を待たずに演出へ進める。
    // 回収自体はクリア後も続き、終わった時点でonScoreCollectedが発火する
    win() {
        if (this.state === "cleared") return
        this.state = "cleared"
        // this.se.bossDefeat.play()
        this.onWin()
        this.addScript(() => this.waitScoreCollected())
    }

    // ゲームオーバー。何度呼ばれてもonLoseは1度だけ発火する
    lose() {
        if (this.state === "game-over") return
        this.state = "game-over"
        this.onLose(this.score)
    }

    private *waitScoreCollected(): Generator<void, void, void> {
        while (this.bullets.some((b) => b.type === "score")) {
            yield
        }

        this.onScoreCollected(this.score)
    }

    private updateBulletAndEnemy() {
        if (!this.player.isInvincible() && this.state === "playing") {
            // グレイズ: 当たり判定には触れずにGRAZE_Rの内側にある敵弾1発につき、毎フレームスコアを加算する
            const grazeCircle = { p: this.player.p, r: this.player.GRAZE_R }
            let grazeCount = 0

            this.bullets
                .filter((b) => b.type === "enemy")
                .forEach((b) => {
                    if (this.bulletCollision.isColliding(b, this.player)) {
                        this.player.hit(b.damage)

                        if (b.isScorable) {
                            b.life = 0
                        }
                    } else if (this.bulletCollision.isColliding(b, grazeCircle)) {
                        grazeCount++
                    }
                })

            if (grazeCount > 0 && !this.player.isInvincible()) {
                this.score += grazeCount
                this.se.graze.play()
            }
        }

        this.bullets
            .filter((b) => b.type === "score")
            .forEach((b) => {
                if (this.bulletCollision.isColliding(b, this.player)) {
                    this.se.graze.play()
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
                        // レーザーは貫通させ、当たった敵ごとに消えず触れている間ずっと削り続ける
                        if (b.collision !== "laser") b.life = 0

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
                this.se.crush.play()
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
