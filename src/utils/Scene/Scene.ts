import { Dom } from "../../Dom"

/**
 * シーン専用のDOMルート要素を自動でDom.containerに追加/削除する。
 * 各シーンは自分のDOM要素をすべてthis.rootの中に入れれば、
 * 終了時にthis.root.remove()が一括で後片付けしてくれる。
 */
export abstract class Scene {
    readonly root = document.createElement("div")

    async start(): Promise<void> {
        Dom.container.appendChild(this.root)
        await this.onStart()
    }

    async end(): Promise<void> {
        await this.onEnd()
        this.root.remove()
    }

    protected abstract onStart(): Promise<void>
    protected abstract onEnd(): Promise<void>

    abstract update(): void
}
