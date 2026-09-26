export namespace GenUtils {
    /**
     * 複数のジェネレータを同時に進める
     *
     * 全ジェネレータが終了するまで yield し続ける。
     *
     * @example
     * yield* parallel({
     *     attackA: this.attackA(),
     *     attackB: this.attackB(),
     * })
     */
    export function* all<T, K extends string>(
        gens: Record<K, Generator<void, T, void>>,
    ): Generator<void, Record<K, T>, void> {
        const keys = Object.keys(gens) as K[]
        const results = {} as Record<K, T>
        const activeKeys = new Set(keys)

        while (activeKeys.size > 0) {
            for (const key of activeKeys) {
                const step = gens[key].next()
                if (step.done) {
                    results[key] = step.value
                    activeKeys.delete(key)
                }
            }

            // まだ完了していないジェネレータがある場合は1回 yield して親に制御を戻す
            if (activeKeys.size > 0) {
                yield
            }
        }

        return results
    }

    /**
     * 複数のジェネレータを同時に進める。
     * いずれか1つが終了した時点で全体を終了し、
     * 最初に終了したジェネレータのインデックスを返す。
     *
     * @example
     * // タイムアウトつきの攻撃パターン
     * const result = yield* race({
     *      attack: attack(),
     *      timeout: wait(300),
     * })
     * if (result.key === "timeout") {
     *     // タイムアウトで終了した場合の処理
     * }
     */
    type GeneratorReturn<T> = T extends Generator<unknown, infer R, unknown> ? R : never

    type RaceResult<T extends Record<string, Generator<unknown, unknown, unknown>>> = {
        [K in keyof T]: {
            key: K
            value: GeneratorReturn<T[K]>
        }
    }[keyof T]

    export function* race<T extends Record<string, Generator<unknown, unknown, unknown>>>(
        gens: T,
    ): Generator<void, RaceResult<T>, void> {
        const G = Object.entries(gens) as [keyof T, T[keyof T]][]

        while (true) {
            for (const [key, g] of G) {
                const res = g.next()
                if (res.done) {
                    return { key, value: res.value } as RaceResult<T>
                }
            }
            yield
        }
    }

    /**
     * n フレーム待つジェネレータ。
     * parallel / race と組み合わせて使うと便利。
     *
     */
    export function* waitFrames(n: number): Generator<void, void, void> {
        yield* Array(n)
    }

    /**
     * ジェネレータを n 回繰り返す。
     *
     * @example
     * yield* repeat(3, () => this.attackPattern())
     */
    export function* repeat(
        n: number,
        gen: (index: number) => Iterable<void, void, unknown>,
    ): Generator<void, void, unknown> {
        for (let i = 0; i < n; i++) {
            yield* gen(i)
        }
    }

    /**
     * ジェネレータのリストを順番に実行する。
     * 配列で渡せるので、動的にパターンを組み立てるときに便利。
     *
     * @example
     * yield* sequence([
     *     this.phase1(),
     *     this.phase2(),
     *     this.phase3(),
     * ])
     */
    export function* sequence(gens: Generator<void, void, unknown>[]): Generator<void, void, unknown> {
        for (const gen of gens) {
            yield* gen
        }
    }

    export function* waitForPromise<T>(promise: Promise<T>): Generator<void, T, void> {
        let state: { ok: true; value: T } | { ok: false; error: unknown } | undefined

        promise.then(
            (value) => {
                state = { ok: true, value }
            },
            (error) => {
                state = { ok: false, error }
            },
        )

        while (state === undefined) yield

        if (!state.ok) throw state.error
        return state.value
    }
}
