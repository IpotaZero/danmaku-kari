import { uid } from "../utils/Functions/uid"

export abstract class IteratorQueue {
    protected scripts = new Map<string, Generator>()

    private sleepFrame: number = 0

    update() {
        if (this.sleepFrame > 0) {
            this.sleepFrame--
            return
        }

        // 全弾が毎フレーム通るので、イテレータヘルパーや配列を作らずに回す(スマホでのGC対策)。
        // Mapは走査中に消しても、走査中に足されたものも含めて正しく回れる
        for (const [id, g] of this.scripts) {
            if (g.next().done) this.scripts.delete(id)
        }
    }

    sleep(frame: number) {
        this.sleepFrame = frame
    }

    clearScripts() {
        this.scripts.clear()
    }

    addScript(
        g: (me: this) => Iterable<unknown, unknown, void>,
        { loop = 1, margin = 0, id = uid() }: { loop?: number; margin?: number; id?: string } = {},
    ) {
        const me = this

        this.scripts.set(
            id,
            (function* () {
                // 全弾が発射時に通るので、待つためだけの配列を作らない
                for (let i = 0; i < margin; i++) yield

                while (loop--) {
                    yield* g(me)
                }
            })(),
        )
    }

    removeScript(id: string) {
        this.scripts.delete(id)
    }
}
