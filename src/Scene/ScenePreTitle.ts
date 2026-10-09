import { App } from "../App"
import { Scene } from "../utils/Scene/Scene"

/**
 * ブラウザはユーザー操作があるまで音を鳴らさせてくれないので、
 * タイトルの前に一度クリックかキー入力を受け付けてからSceneTitleへ進む。
 */
export class ScenePreTitle extends Scene {
    private readonly listeners = new AbortController()

    protected async onStart(): Promise<void> {
        console.log("ScenePreTitle")

        this.root.classList.add("scene-pre-title", "paper-scene")
        // 題辞。冬まで生き残ってしまった蜂の句を、ゲームの最初に一度だけ置く
        this.root.insertAdjacentHTML(
            "beforeend",
            `
            <div class="pre-title-epigraph">
                <span>&nbsp;</span>
                <span class="pre-title-haiku">冬蜂の死にどころなく歩きけり</span>
                <span class="pre-title-poet">村上鬼城</span>
            </div>
            <div class="pre-title-message">Click or Press Any Key</div>
        `,
        )

        const textureOverlay = document.createElement("div")
        textureOverlay.className = "texture-overlay"
        this.root.appendChild(textureOverlay)

        // タッチ操作ではpointerdownがユーザー操作として扱われないので、clickで受け付ける
        const signal = this.listeners.signal
        window.addEventListener("click", () => this.proceed(), { signal })
        window.addEventListener(
            "keydown",
            (e) => {
                // Escapeはユーザー操作として扱われず音の許可が下りない
                if (e.code !== "Escape") this.proceed()
            },
            { signal },
        )
    }

    protected async onEnd(): Promise<void> {}

    update(): void {}

    private proceed() {
        this.listeners.abort()

        // ユーザー操作のイベント内でないとAudioContextを再開できないブラウザがあるので、ここで起こしておく
        App.bm.play()
        App.se.menu.playOk()

        App.sc.goto(async () => import("./SceneTitle").then(({ SceneTitle }) => new SceneTitle()))
    }
}
