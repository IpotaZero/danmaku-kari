import { uid } from "../utils/Functions/uid"

export abstract class IteratorQueue {
    protected scripts = new Map<string, Generator>()

    private sleepFrame: number = 0

    update() {
        if (this.sleepFrame > 0) {
            this.sleepFrame--
            return
        }

        const finished = this.scripts
            .entries()
            .filter(([id, g]) => g.next().done)
            .map(([id, _]) => id)

        finished.forEach((id) => {
            this.scripts.delete(id)
        })
    }

    sleep(frame: number) {
        this.sleepFrame = frame
    }

    clearScripts() {
        this.scripts.clear()
    }

    // 外部(装備など)からもエフェクト用の一時的なスクリプトを積めるようpublicにしている
    addScript(
        g: (me: this) => Iterable<void, void, void>,
        { loop = 1, margin = 0, id = uid() }: { loop?: number; margin?: number; id?: string } = {},
    ) {
        const me = this

        this.scripts.set(
            id,
            (function* () {
                yield* Array(margin)

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
