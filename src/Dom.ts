export class Dom {
    static container: HTMLElement

    static init() {
        this.container = document.getElementById("container")!
    }

    // フェードアウトさせてからDOMから取り除く。消えている途中の要素には触れられないようにする
    static fadeOutAndRemove(element: HTMLElement, durationMS: number) {
        element.style.pointerEvents = "none"
        element
            .animate({ opacity: 0 }, { duration: durationMS, easing: "ease-out", fill: "forwards" })
            .addEventListener("finish", () => element.remove())
    }
}
