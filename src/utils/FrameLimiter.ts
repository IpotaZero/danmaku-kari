/**
 * rAFごとに呼ばれる描画を、指定したfps以下に間引く。
 * 経過時間で判定するので、画面のリフレッシュレート(60/90/120Hz)に関わらず同じfpsになる。
 */
export class FrameLimiter {
    private interval: number
    private readonly gate = this.run()

    constructor(fps: number) {
        this.interval = 1000 / fps
    }

    setFPS(fps: number) {
        this.interval = 1000 / fps
    }

    // rAFごとに1回呼ぶ。このフレームを描いてよければtrue
    shouldDraw(): boolean {
        return this.gate.next().value
    }

    private *run(): Generator<boolean, never, void> {
        let last = performance.now()

        while (true) {
            const now = performance.now()

            // rAFの間隔の揺れで1フレーム遅れないよう、3msだけ早めに許す(Looperと同じ)
            if (now - last < this.interval - 3) {
                yield false
                continue
            }

            // 基準時刻は間隔ぶんだけ進めて、揺れのずれを溜めない。大きく遅れたときは今に合わせ直す
            last = now - last > this.interval * 2 ? now : last + this.interval
            yield true
        }
    }
}
