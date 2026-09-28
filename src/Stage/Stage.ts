import { Game } from "../Game/Game"
import { IteratorQueue } from "../Game/IteratorQueue"

export abstract class Stage extends IteratorQueue {
    private flashAlpha = 0
    private flashColor = "#ffffff"

    constructor(protected readonly game: Game) {
        super()
        this.addScript(() => this.G(), { id: "runToEnd" })
    }

    // G()が最後まで到達したらステージクリア
    get isCleared(): boolean {
        return !this.scripts.has("runToEnd")
    }

    abstract G(): Generator<void, void, void>

    protected *waitAllEnemiesDead(): Generator<void, void, void> {
        while (this.game.enemies.length > 0) {
            yield
        }
    }

    protected scorenizeAllBullets() {
        this.game.bullets.filter((b) => b.type === "enemy").forEach((b) => b.scorenize())
    }

    // スコア化した弾が自機に届いて回収されるまで待つ。
    // これを待たずにG()を終える(=ステージクリア)と、回収前にwin()のスコアが確定してしまい
    // scorenizeAllBullets()で稼いだ分が加算されずに失われる
    protected *waitAllBulletsScored(): Generator<void, void, void> {
        while (this.game.bullets.some((b) => b.type === "score")) {
            yield
        }
    }

    // 画面全体を指定色でフラッシュさせる(frameフレームかけて薄れて消える)
    flash(color: string = "#ffffff", frame: number = 12) {
        this.flashColor = color
        this.addScript(() => this.flashG(frame), { id: "flash" })
    }

    private *flashG(frame: number): Generator<void, void, void> {
        for (let i = 0; i < frame; i++) {
            this.flashAlpha = 1 - i / frame
            yield
        }

        this.flashAlpha = 0
    }

    // 画面全体を揺らす。実体はCameraの揺れなので、Player被弾時の揺れと共存できる
    shake(intensity: number = 8, frame: number = 20) {
        this.game.camera.shake(intensity, frame)
    }

    // Gameの描画が全て終わった後に呼ばれる、画面全体を覆うオーバーレイの描画
    drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (this.flashAlpha <= 0) return

        ctx.save()
        ctx.globalAlpha = this.flashAlpha
        ctx.fillStyle = this.flashColor
        ctx.fillRect(0, 0, width, height)
        ctx.restore()
    }
}
