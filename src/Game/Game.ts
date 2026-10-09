import { Camera } from "./Actor/Camera"
import { DigitalInput } from "@ipota/input"
import { Vec, vec } from "@ipota/vec"
import { Player, PlayerConfig } from "./Actor/Player"
import { Enemy } from "./Actor/Enemy"
import { Bullet } from "./Actor/Bullet"
import { BulletDrawer } from "./BulletDrawer/BulletDrawer"
import { BulletCollision } from "./BulletCollision"
import { IteratorQueue } from "./IteratorQueue"
import { Stage } from "../Stage/Stage"
import { TextBox } from "@ipota/my-utils"
import { FigureLayer } from "../utils/FigureLayer"
import { TouchControls } from "./TouchControls"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Dom } from "../Dom"
import { Scenery } from "../World/Scenery"

const FPS = 60

export type GameAction = "right" | "left" | "up" | "down" | "slow" | "suicide" | "action" | "ok" | "cancel"

// タッチドラッグ時、方向キーの代わりに移動量(ワールド座標のベクトル)を直接渡すための拡張。
// TouchControls以外(キーボード/ゲームパッド)は実装しないため、未実装を許すoptionalにしている
export type GameInput = DigitalInput.Reader<GameAction> & {
    getTouchMoveVector?(): Vec | undefined
}

// ゲーム中に鳴らすSE。App.seをそのまま渡せるよう、play()できることだけを要求する
export type GameSE = Record<
    "graze" | "hit" | "dash" | "u" | "crush" | "bossDefeatPre" | "bossDefeat" | "charge" | "gameover" | "bulletSuzu",
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
    // ゲーム全体の更新速度を変える(ボス撃破時のスローモーション用)
    setFPS: (fps: number) => void
    // ステージのある場所の景色。キャンバスの地面に模様を流す
    scenery: Scenery
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

    // 敵の乱数のシード。Game はステージに入るたびに作り直されるので、n 体目の敵は毎回同じシードになる
    readonly enemySeeds = (function* () {
        for (let i = 0; ; i++) yield i
    })()
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

    // 地面の模様を流すための経過フレーム数。スローモーション中は地面もゆっくり流れる
    private frame = 0
    private readonly scenery: Scenery

    // WebGLの初期化や弾のスプライト作りをステージに入るたびにやり直さないよう、全ステージで使い回す
    private static readonly bulletDrawer = new BulletDrawer()
    // スクリプトがupdate中に積む、ワールド座標の描画命令。描画はrAFごとに1回なので、update中に直接ctxへ描かず、ここに溜めてdraw()で再生する
    private readonly worldDrawings: ((ctx: CanvasRenderingContext2D) => void)[] = []
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
    private readonly setFPS: (fps: number) => void

    private constructor({ input, se, onWin, onLose, onScoreCollected, playerConfig, setFPS, scenery }: GameConfig) {
        super()

        this.scenery = scenery

        this.setFPS = setFPS
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
        // スロー中にシーンを抜けても速さが戻るように
        this.setSpeed(1)
        this.resizeObserver.disconnect()
        this.figureLayer.dispose()
    }

    update(): void {
        // 1回のrAFで複数回updateされても、描かれるのは最後のupdateで積まれた分だけ
        this.worldDrawings.length = 0
        this.frame++

        this.touchControls.update()

        if (this.state === "playing" && !this.textBox.isShowing && this.input.isPushed("suicide")) {
            this.player.selfDestruct()
        }

        this.stage.update()
        this.updateBulletAndEnemy()

        this.updatePlayer()

        this.updateCamera()

        if (this.stage.isCleared()) this.win()

        super.update()
    }

    // ワールド座標での描画を予約する。次のdraw()で、本体の描画の上に重ねて描かれる
    drawInWorld(f: (ctx: CanvasRenderingContext2D) => void) {
        this.worldDrawings.push(f)
    }

    // ステージクリア。何度呼ばれてもonWinは1度だけ発火する。
    // スコア化した弾の回収(waitScoreCollected)を待たずに演出へ進める。
    // 回収自体はクリア後も続き、終わった時点でonScoreCollectedが発火する
    win() {
        if (this.state === "cleared") return
        this.state = "cleared"
        this.se.crush.play()
        this.onWin()
        this.addScript(() => this.waitScoreCollected())
    }

    // ゲームオーバー。何度呼ばれてもonLoseは1度だけ発火する
    lose() {
        if (this.state === "game-over") return
        this.state = "game-over"
        this.onLose(this.score)
    }

    // ゲーム全体の進む速さを変える(1で通常)。更新回数そのものを変えるので、遅くするとカクつく
    setSpeed(scale: number) {
        this.setFPS(FPS * scale)
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

            // 弾は毎フレーム数百発を回すので、filterで配列を作らずに型で振り分ける(スマホでのGC対策)
            this.bullets.forEach((b) => {
                if (b.type !== "enemy") return

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

        this.bullets.forEach((b) => {
            if (b.type !== "score") return

            if (this.bulletCollision.isColliding(b, this.player)) {
                this.se.graze.play()
                this.score++
                b.life = 0
            }
        })

        this.bullets.forEach((b) => {
            if (b.type !== "friend") return

            this.enemies.forEach((e) => {
                if (e.isInvincible) return

                if (this.bulletCollision.isColliding(b, e)) {
                    // レーザーは貫通させ、当たった敵ごとに消えず触れている間ずっと削り続ける
                    if (b.collision !== "rect") b.life = 0

                    e.hit(b.damage)
                }
            })
        })

        this.bullets.forEach((b) => b.update())
        this.enemies.forEach((e) => e.update())

        // 生きている弾を前に詰めて、配列を作り直さずに死んだ弾を除く
        let aliveCount = 0
        this.bullets.forEach((b) => {
            if (b.life > 0) this.bullets[aliveCount++] = b
        })
        this.bullets.length = aliveCount

        const aliveEnemies = this.enemies.filter((e) => {
            if (e.life <= 0) {
                this.se.crush.play()
                this.addScript(() => e.onDead())
                this.cancelBulletsOf(e)
            }

            return e.life > 0
        })
        this.enemies.length = 0
        this.enemies.push(...aliveEnemies)
    }

    // 倒れた敵が撃って画面に残っている弾を、すべて蜜に変える。
    // 部位を壊せば、その部位の弾がその場で消えるので、今いちばん邪魔な弾を撃っている部位を狙う理由になる。
    // 障壁と同じく、まだ当たり判定のない(現れかけの)弾も変える。レーザーなど蜜にならない弾は、撃ち手が倒れたときの消え方を自分で持っている
    private cancelBulletsOf(e: Enemy) {
        this.bullets.forEach((b) => {
            if (b.owner !== e || !b.isScorable) return
            if (b.type !== "enemy" && b.type !== "neutral") return

            b.scorenize()
        })
    }

    private updatePlayer(): void {
        this.player.update()
    }

    private updateCamera(): void {
        this.camera.update()
    }

    draw(): void {
        const ctx = this.ctx

        ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT)

        ctx.save()
        this.camera.apply(ctx, this.WIDTH, this.HEIGHT)
        // 地面は弾より奥に、ごく薄く描く
        this.scenery.ground.draw(ctx, this.WIDTH, this.HEIGHT, this.frame)
        this.bullets.forEach((b) => Game.bulletDrawer.draw(b, ctx))
        ctx.restore()

        // GPUでまとめて描いた弾は、カメラ変換込みの画面座標で焼き込まれているため
        // ctxのtransformを掛けていない状態（Camera.apply()の外）で合成する
        Game.bulletDrawer.flush(ctx, this.camera.getTransform(), this.WIDTH, this.HEIGHT)

        ctx.save()
        this.camera.apply(ctx, this.WIDTH, this.HEIGHT)
        // 重なった敵の影が別の敵の線を暗くしないよう、影は先にまとめて描く
        this.enemies.forEach((e) => e.drawShade(ctx))
        this.enemies.forEach((e) => e.draw(ctx))
        if (this.state !== "game-over") this.player.draw(ctx)
        this.worldDrawings.forEach((f) => {
            ctx.save()
            f(ctx)
            ctx.restore()
        })
        ctx.restore()

        this.stage.drawOverlay(ctx, this.WIDTH, this.HEIGHT)
    }
}
