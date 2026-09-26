import { Game } from "../Game/Game"
import { input } from "../input"
import { sc } from "../sc"
import StageTest from "../Stage/StageTest"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"

export class SceneGame extends Scene {
    private readonly game: Game
    private resultMenu?: Menu

    constructor() {
        super()

        this.game = new Game(
            (game) => new StageTest(game),
            input,
            () => this.showResultMenu("Stage Clear!"),
            () => this.showResultMenu("Game Over"),
        )
    }

    protected async onStart(): Promise<void> {
        this.root.classList.add("scene-game")
        this.game.canvas.id = "main"
        this.root.append(this.game.canvas, this.game.textBox.box)
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
        // クリア/ゲームオーバー後もGame自体の更新(敵・弾・カメラなど)は続ける
        this.game.update()
        this.resultMenu?.update()
    }

    // クリア/ゲームオーバー時に、タイトルへ戻れるメニューを重ねて表示する
    private showResultMenu(title: string) {
        if (this.resultMenu) return

        this.resultMenu = new Menu(
            `<div id="root"></div>`,
            {
                elementId: "root",
                title,
                options: () => [
                    [
                        {
                            type: "select",
                            label: "タイトルへ戻る",
                            onSelect: () => {
                                sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
                            },
                        },
                    ],
                ],
            },
            input,
            {
                playCursor: () => {},
                playOk: () => {},
                playCancel: () => {},
                playDisable: () => {},
            },
        )

        this.resultMenu.container.classList.add("pause-menu")
        this.root.appendChild(this.resultMenu.container)
    }
}
