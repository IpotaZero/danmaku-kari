// 表示/非表示を透明度でフェードさせる時間(ms)。CSS側のtransitionと合わせる
const FADE_MS = 300

// Stageから呼ばれ、立ち絵(APNG)をキャンバスの上に並べて表示する。
// APNGの再生自体はブラウザ側のネイティブ機能に任せるため、imgタグを置くだけで良い
export class FigureLayer {
    readonly box = document.createElement("div")
    private readonly figures = new Map<string, HTMLImageElement>()

    constructor() {
        this.box.classList.add("figure-layer")
    }

    // idを指定して立ち絵を表示する。同じidを再度呼ぶと画像を差し替える(表情差分などに使える)。
    // offsetPercentは画面幅に対する左右のずれ(負で左、正で右。中央基準)
    show(id: string, src: string, offsetPercent: number = 0) {
        const img = this.figures.get(id) ?? this.createFigure(id)
        img.src = src
        img.style.setProperty("--offset", `${offsetPercent}%`)

        // 生成直後にクラスを付けるとtransitionが効かないため、一度リフローを挟む
        void img.offsetWidth
        img.classList.add("figure--visible")
    }

    hide(id: string) {
        const img = this.figures.get(id)
        if (!img) return

        this.figures.delete(id)
        img.classList.remove("figure--visible")
        setTimeout(() => img.remove(), FADE_MS)
    }

    hideAll() {
        this.figures.forEach((_, id) => this.hide(id))
    }

    dispose() {
        this.box.remove()
    }

    private createFigure(id: string): HTMLImageElement {
        const img = document.createElement("img")
        img.classList.add("figure")
        this.box.appendChild(img)
        this.figures.set(id, img)
        return img
    }
}
