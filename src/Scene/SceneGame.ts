import { playerData } from "../Data/PlayerData"
import { Game } from "../Game/Game"
import { input } from "../input"
import type { MapNode } from "../Map/MapGraph"
import { sc } from "../sc"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"

export class SceneGame extends Scene {
    private readonly game: Game
    private resultMenu?: Menu

    constructor(private readonly node: MapNode) {
        super()

        this.game = new Game(
            this.node.stage,
            input,
            () => {
                playerData.recordStageClear(this.node.id, playerData.getLoadout().main)
                this.showResultMenu("--:: 作戦成功 ::--")
            },
            () => this.showResultMenu("--:: 作戦失敗 ::--"),
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
                            label: "Retry",
                            onSelect: () => {
                                sc.goto(async () => new SceneGame(this.node))
                            },
                        },
                        {
                            type: "select",
                            label: "Back",
                            onSelect: () => {
                                sc.goto(async () => import("./SceneMap").then(({ SceneMap }) => new SceneMap(this.node.id)))
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
