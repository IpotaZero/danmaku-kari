import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { IteratorQueue } from "../Game/IteratorQueue"
import { Figure } from "./Figure"

export abstract class Stage extends IteratorQueue {
    private flashAlpha = 0
    private flashColor = "#ffffff"

    constructor(protected readonly game: Game) {
        super()
        this.addScript(() => this.H(), { id: "runToEnd" })
    }

    // G()が最後まで到達したらステージクリア
    isCleared(): boolean {
        return !this.scripts.has("runToEnd")
    }

    abstract G(): Generator<void, void, void>

    private *H() {
        yield* this.G()
        this.shake(16, 60)
        this.flash("#dff6ffc0", 20)
        this.scorenizeAllBullets()
    }

    protected *waitAllEnemiesDead(): Generator<void, void, void> {
        while (this.game.enemies.length > 0) {
            yield
        }
    }

    protected *waitDead(enemies: readonly Enemy[]): Generator<void, void, void> {
        while (enemies.some((e) => e.life > 0)) {
            yield
        }
    }

    protected scorenizeAllBullets() {
        this.game.bullets.filter((b) => b.type === "enemy" || b.type === "neutral").forEach((b) => b.scorenize())
    }

    // 画面全体を指定色でフラッシュさせる(frameフレームかけて薄れて消える)。敵の演出からも game.stage.flash で呼べる
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
    protected shake(intensity: number = 8, frame: number = 20) {
        this.game.camera.shake(intensity, frame)
    }

    // 地の文。時と場所は「五日前。霧の沢。」のように一行に縮めて書く
    protected *narrate(...texts: string[]): Generator<void, void, void> {
        yield* this.game.textBox.say(texts)
    }

    // 台詞。texts は同じ人物が続けて話す
    protected *talk(name: string, ...texts: string[]): Generator<void, void, void> {
        yield* this.game.textBox.say(texts, { name })
    }

    // 立ち絵を表示する。同じ人物の立ち絵を出し直すと、表情だけが差し替わる
    protected showFigure(figure: Figure) {
        this.game.figureLayer.show(figure.id, figure.src, figure.offsetPercent)
    }

    protected hideFigure(figure: Figure) {
        this.game.figureLayer.hide(figure.id)
    }

    protected hideAllFigures() {
        this.game.figureLayer.hideAll()
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
