import { uid } from "../utils/Functions/uid"

// ジェネレータを並べて毎フレーム一歩ずつ進める。Actor・Game・Stageは継承せずに持つ
export class IteratorQueue {
    private readonly generators = new Map<string, Generator>()

    update() {
        // 全弾が毎フレーム通るので、イテレータヘルパーや配列を作らずに回す(スマホでのGC対策)。
        // Mapは走査中に消しても、走査中に足されたものも含めて正しく回れる
        for (const [id, g] of this.generators) {
            if (g.next().done) this.generators.delete(id)
        }
    }

    add(
        g: () => Iterable<unknown, unknown, void>,
        { loop = 1, margin = 0, id = uid() }: { loop?: number; margin?: number; id?: string } = {},
    ) {
        this.generators.set(
            id,
            (function* () {
                // 全弾が発射時に通るので、待つためだけの配列を作らない
                for (let i = 0; i < margin; i++) yield

                while (loop--) {
                    yield* g()
                }
            })(),
        )
    }

    has(id: string) {
        return this.generators.has(id)
    }

    remove(id: string) {
        this.generators.delete(id)
    }

    clear() {
        this.generators.clear()
    }
}
