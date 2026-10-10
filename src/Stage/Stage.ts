import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { IteratorQueue } from "../Game/IteratorQueue"
import { Figure } from "./Figure"

export abstract class Stage {
    readonly scripts = new IteratorQueue()

    private flashAlpha = 0
    private flashColor = "#ffffff"

    constructor(protected readonly game: Game) {
        this.scripts.add(() => this.H(), { id: "runToEnd" })
    }

    update() {
        this.scripts.update()
    }

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

    flash(color: string = "#ffffff", frame: number = 12) {
        this.flashColor = color
        this.scripts.add(() => this.flashG(frame), { id: "flash" })
    }

    private *flashG(frame: number): Generator<void, void, void> {
        for (let i = 0; i < frame; i++) {
            this.flashAlpha = 1 - i / frame
            yield
        }

        this.flashAlpha = 0
    }

    protected shake(intensity: number = 8, frame: number = 20) {
        this.game.camera.shake(intensity, frame)
    }

    protected showFigure(figure: Figure) {
        this.game.figureLayer.show(figure.id, figure.src, figure.offsetPercent)
    }

    protected hideFigure(figure: Figure) {
        this.game.figureLayer.hide(figure.id)
    }

    protected hideAllFigures() {
        this.game.figureLayer.hideAll()
    }

    drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (this.flashAlpha <= 0) return

        ctx.save()
        ctx.globalAlpha = this.flashAlpha
        ctx.fillStyle = this.flashColor
        ctx.fillRect(0, 0, width, height)
        ctx.restore()
    }
}
