import { input } from "../input"
import { sc } from "../sc"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"

export class SceneTitle extends Scene {
    private menu?: Menu

    protected async onStart(): Promise<void> {
        this.root.classList.add("scene-title")
        this.root.innerHTML = `
            <div class="title-content">
                <div class="title-version">ver. dev</div>
                <div class="title-copyright">&copy; ososikirackets</div>
                <div class="title-logo">The<br />(仮)<br />Days!</div>
            </div>
        `

        this.menu = new Menu(
            `<div class="title-menu-stack"><div id="root"></div></div>`,
            {
                elementId: "root",
                options: () => [
                    [
                        {
                            type: "select",
                            label: "Start",
                            onSelect: () => {
                                sc.goto(async () => import("./SceneMap").then(({ SceneMap }) => new SceneMap()))
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

        this.menu.container.classList.add("title-menu")
        this.root.appendChild(this.menu.container)

        const textureOverlay = document.createElement("div")
        textureOverlay.className = "texture-overlay"
        this.root.appendChild(textureOverlay)
    }

    protected async onEnd(): Promise<void> {}

    update(): void {
        this.menu?.update()
    }
}
