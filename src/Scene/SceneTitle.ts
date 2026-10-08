import { Awaits } from "@ipota/functions"
import { App } from "../App"
import { Menu } from "../utils/Menu/Menu"
import { Scene } from "../utils/Scene/Scene"
import { SettingsMenu } from "./SettingsMenu"
import { TitleMeadow } from "./TitleMeadow"

export class SceneTitle extends Scene {
    private menu?: Menu

    protected async onStart(): Promise<void> {
        console.log("SceneTitle")

        this.root.classList.add("scene-title", "paper-scene")
        this.root.appendChild(new TitleMeadow().element)
        this.root.insertAdjacentHTML(
            "beforeend",
            `
            <div class="title-content">
                <div class="title-version">ver. dev</div>
                <div class="title-copyright">&copy; ososikirackets</div>
                <div class="title-logo">
                    <span class="title-logo-line">The</span>
                    <span class="title-logo-line">Scattered</span>
                    <span class="title-logo-line">Days</span>
                </div>
            </div>
        `,
        )

        const menu: Menu = new Menu(
            `<div class="title-menu-stack"><div id="root"></div>${SettingsMenu.HTML}</div>`,
            {
                elementId: "root",
                options: () => [
                    [
                        {
                            type: "select",
                            label: "Start",
                            onSelect: () => {
                                App.se.start.play()
                                App.sc.goto(async () => import("./SceneMap").then(({ SceneMap }) => SceneMap.create()))
                            },
                        },
                    ],
                    [
                        {
                            type: "submenu",
                            label: "Settings",
                            // #rootはtitle.css側で横へ退場させるので、ここでは隠さない
                            hides: [],
                            subMenu: () => new SettingsMenu(menu).box(),
                        },
                    ],
                ],
            },
            App.input,
            App.se.menu,
        )

        menu.container.classList.add("title-menu")
        this.root.appendChild(menu.container)
        this.menu = menu

        const textureOverlay = document.createElement("div")
        textureOverlay.className = "texture-overlay"
        this.root.appendChild(textureOverlay)

        if (document.fullscreenEnabled) {
            const fullscreenToggle = document.createElement("button")
            fullscreenToggle.className = "title-fullscreen-toggle"
            fullscreenToggle.textContent = "⛶"
            fullscreenToggle.addEventListener("click", () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen()
                } else {
                    document.documentElement.requestFullscreen()
                }
            })
            this.root.appendChild(fullscreenToggle)
        }

        this.startBGM()
    }

    private async startBGM() {
        await Promise.all([App.bm.load({ src: "assets/bgm/title.mp3", trackVolume: 0.5 }), Awaits.sleep(1000)])
        await App.bm.play()
    }

    protected async onEnd(): Promise<void> {
        await App.bm.fadeOut(1)
    }

    update(): void {
        this.menu?.update()
    }
}
