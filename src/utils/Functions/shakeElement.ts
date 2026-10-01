// DOM要素ごと揺らす。キャンバスの枠ごと動くので、Cameraの揺れより強く感じる
export function shakeElement(element: HTMLElement, durationMS = 1500, initialAmplitude = 12) {
    const FRAMES = 30

    const keyframes: Keyframe[] = Array.from({ length: FRAMES + 1 }, (_, i) => {
        // 最終フレームだけ中央に戻す
        if (i === FRAMES) return { transform: "translate(0px, 0px)" }

        const amplitude = initialAmplitude * (1 - i / FRAMES)
        const dx = (Math.random() * 2 - 1) * amplitude
        const dy = (Math.random() * 2 - 1) * amplitude * 0.5
        return { transform: `translate(${dx}px, ${dy}px)` }
    })

    element.animate(keyframes, { duration: durationMS, easing: "linear", fill: "none" })
}
