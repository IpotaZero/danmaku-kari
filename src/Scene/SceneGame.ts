import { Game } from "../Game/Game"
import { input } from "../input"
import StageTest from "../Stage/StageTest"
import { Scene } from "../utils/Scene/Scene"

export class SceneGame extends Scene {
    private readonly game: Game

    constructor() {
        super()

        this.game = new Game(
            (game) => new StageTest(game),
            input,
            () => {},
            () => {},
        )
    }

    protected async onStart(): Promise<void> {
        this.root.classList.add("scene-game")
        this.game.canvas.id = "main"
        this.root.append(this.game.canvas, this.game.textBox.box)
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
        this.game.update()
    }
}
