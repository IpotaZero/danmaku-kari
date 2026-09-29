import { Stage } from "../Stage"

export default class extends Stage {
    *G() {
        this.showFigure("hachinoko", "assets/figure/Hachinoko.webp", { offsetPercent: -30 })
        yield* this.game.textBox.say(["未実装"])
        this.hideFigure("hachinoko")
    }
}
