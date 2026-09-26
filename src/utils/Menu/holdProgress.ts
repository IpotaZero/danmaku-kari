/**
 * 「ok」が押され続けている割合(0〜1)を毎フレームyieldするGenerator。
 * 離すと0に戻ってまた押されるのを待ち直す。durationMs経過したらtrueでreturnする。
 */
export function* holdProgress(
    durationMs: number,
    isOkPressed: () => boolean,
    config: {
        disabled?: () => boolean
        onFailed?: () => void
    },
): Generator<number, true, void> {
    // いったん離されるまで待つ
    while (isOkPressed() || config.disabled?.()) yield 0

    while (true) {
        // 押し始められるまで待つ
        while (!isOkPressed()) yield 0

        // 計測開始
        const startedAt = performance.now()
        while (true) {
            const elapsed = performance.now() - startedAt
            if (elapsed >= durationMs) return true

            yield elapsed / durationMs

            if (!isOkPressed() || config.disabled?.()) {
                config.onFailed?.()
                break // 離されたので最初からやり直す
            }
        }
    }
}
