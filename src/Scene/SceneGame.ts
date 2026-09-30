import { playerData } from "../Data/PlayerData"
import { Game } from "../Game/Game"
import { mainEquipments, subEquipments } from "../Game/Equipment/PlayerEquipment"
import type { PlayerConfig } from "../Game/Actor/Player"
import type { MapNode } from "../Map/MapGraph"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"
import { App } from "../App"

export class SceneGame extends Scene {
    private game?: Game
    private resultMenu?: Menu

    constructor(private readonly node: MapNode) {
        super()
    }

    protected async onStart(): Promise<void> {
        console.log(`SceneGame: ${this.node.id}`)

        // ステージ中に残機が増えることはないので、クリア時に開始時から減っていなければノーミス
        const initialLives = playerData.getLives()

        this.game = await Game.create({
            createStage: (game) => this.node.stage(game),
            input: App.input,
            se: App.se,
            onWin: () => {
                this.node.recordClear(playerData, playerData.getLoadout().main, playerData.getLives() === initialLives)
                this.showResultMenu("--:: 道場破り ::--")
            },
            onLose: (score) => {
                playerData.addScore(score)
                this.showResultMenu("--:: 敗北 ::--")
            },
            onScoreCollected: (score) => playerData.addScore(score),
            playerConfig: createPlayerConfig(),
        })

        this.root.classList.add("scene-game")
        this.game.canvas.id = "main"
        this.root.append(this.game.canvas, this.game.figureLayer.box, this.game.textBox.box)
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
                                App.sc.goto(async () => new SceneGame(this.node))
                            },
                        },
                        {
                            type: "select",
                            label: "Back",
                            onSelect: () => {
                                App.sc.goto(async () =>
                                    import("./SceneMap").then(({ SceneMap }) => SceneMap.create(this.node.id)),
                                )
                            },
                        },
                    ],
                ],
                initialCursor: () => ({ row: 0, col: 1 }),
            },
            App.input,
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
