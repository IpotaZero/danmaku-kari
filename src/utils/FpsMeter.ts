/**
 * 画面左上に、1秒ごとの実測fpsを出す。
 * 画面(rAFの回数=リフレッシュレート)・描画・更新を別々に数え、描画は1秒間で一番空いた間隔も出す。
 * 平均fpsが足りていても、間隔の最大が大きければその瞬間にカクついている。
 */
export class FpsMeter {
    readonly element = document.createElement("div")

    private readonly frames = new Rate()
    private readonly draws = new Rate()
    private readonly updates = new Rate()

    constructor() {
        this.element.className = "fps-meter hidden"
    }

    show(visible: boolean) {
        this.element.classList.toggle("hidden", !visible)
    }

    // rAFごとに呼ぶ。1秒たまるたびに表示を書き換える
    countFrame() {
        if (this.frames.tick()) this.render()
    }

    countDraw() {
        this.draws.tick()
    }

    countUpdate() {
        this.updates.tick()
    }

    private render() {
        this.element.textContent = [
            `画面 ${this.frames.fps.toFixed(0)}`,
            `描画 ${this.draws.fps.toFixed(0)} (最大${this.draws.worstMs.toFixed(0)}ms)`,
            `更新 ${this.updates.fps.toFixed(0)}`,
        ].join("\n")
    }
}

// 1秒ずつ区切って、その間に呼ばれた回数と、呼ばれる間隔の最大を測る
class Rate {
    fps = 0
    worstMs = 0

    private readonly counter = this.count()

    // 1秒の区切りを迎えて fps/worstMs が新しくなったらtrue
    tick(): boolean {
        return this.counter.next().value
    }

    private *count(): Generator<boolean, never, void> {
        // 最初の呼び出しは基準の時刻を決めるだけ
        let last = performance.now()
        let start = last
        let frames = 0
        let worst = 0
        yield false

        while (true) {
            const now = performance.now()
            worst = Math.max(worst, now - last)
            last = now
            frames++

            if (now - start < 1000) {
                yield false
                continue
            }

            this.fps = (frames * 1000) / (now - start)
            this.worstMs = worst
            start = now
            frames = 0
            worst = 0
            yield true
        }
    }
}
