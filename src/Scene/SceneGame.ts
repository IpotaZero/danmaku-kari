import { playerData } from "../Data/PlayerData"
import { Game } from "../Game/Game"
import { mainEquipments, subEquipments } from "../Game/Equipment/PlayerEquipment"
import type { PlayerConfig } from "../Game/Actor/Player"
import { input } from "../input"
import type { MapNode } from "../Map/MapGraph"
import { sc } from "../sc"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"

export class SceneGame extends Scene {
    private game?: Game
    private resultMenu?: Menu

    constructor(private readonly node: MapNode) {
        super()
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneGame: ${this.node.id}`)

        this.game = await Game.create(
            (game) => this.node.stage(game),
            input,
            () => {
                playerData.recordStageClear(this.node.id, playerData.getLoadout().main)
                this.showResultMenu("--:: 作戦終了 ::--")
            },
            (score) => {
                playerData.addScore(score)
                this.showResultMenu("--:: 作戦失敗 ::--")
            },
            (score) => playerData.addScore(score),
            createPlayerConfig(),
        )

        this.root.classList.add("scene-game")
        this.game.canvas.id = "main"
        this.root.append(this.game.canvas, this.game.textBox.box)
    }

    protected async onEnd(): Promise<void> {
        this.game?.dispose()
    }

    update(): void {
        // クリア/ゲームオーバー後もGame自体の更新(敵・弾・カメラなど)は続ける
        this.game?.update()
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
                                sc.goto(async () =>
                                    import("./SceneMap").then(({ SceneMap }) => new SceneMap(this.node.id)),
                                )
                            },
                        },
                    ],
                ],
                initialCursor: () => ({ row: 0, col: 1 }),
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

// playerData(セーブデータ)の内容をPlayerConfigへ詰め替える。
// Player自身はplayerDataを直接参照しないので、この変換をScene層で行う
function createPlayerConfig(): PlayerConfig {
    const loadout = playerData.getLoadout()

    return {
        initialLife: playerData.getLives(),
        maxLife: playerData.getMaxLives(),
        mainEquipment: mainEquipments[loadout.main] ?? mainEquipments.standard,
        subEquipment: loadout.sub ? subEquipments[loadout.sub] : undefined,
        onLifeChange: (life) => playerData.setLives(life),
    }
}
