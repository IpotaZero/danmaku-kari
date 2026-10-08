import { Figure } from "../Figure"
import { Stage } from "../Stage"

export default class extends Stage {
    *G() {
        this.showFigure(Figure.hachinoko)
        yield* this.narrate("未実装")
        this.hideFigure(Figure.hachinoko)
    }
}
