// 同じSEを鳴らす最短の間隔(ms)。これより短い間隔で呼ばれた分は無視する
const MIN_INTERVAL_MS = 50

// 効果音1つ分。呼び出されるたびに、鳴っている途中でも止めて最初から再生しなおす
export class Sound {
    private buffer?: AudioBuffer
    private source?: AudioBufferSourceNode
    private lastPlayedAt = -Infinity
    private readonly gain

    constructor(
        path: string,
        private readonly context: AudioContext,
        master: GainNode,
        { volume = 0.5 } = {},
    ) {
        this.gain = context.createGain()
        this.gain.gain.value = volume
        this.gain.connect(master)

        // 読み込みを待たずに使えるようにする。読み込み前にplayされた分は鳴らさない
        fetch(path)
            .then((res) => res.arrayBuffer())
            .then((array) => context.decodeAudioData(array))
            .then((buffer) => (this.buffer = buffer))
            .catch((e) => console.error(`SEの読み込みに失敗しました: ${path}`, e))
    }

    play() {
        if (!this.buffer) return

        const now = performance.now()
        if (now - this.lastPlayedAt < MIN_INTERVAL_MS) return
        this.lastPlayedAt = now

        // ブラウザはユーザー操作前のAudioContextを停止状態にするので、鳴らすたびに再開を試みる
        if (this.context.state === "suspended") this.context.resume()

        this.source?.stop()

        const source = this.context.createBufferSource()
        source.buffer = this.buffer
        source.connect(this.gain)
        source.start()
        this.source = source
    }
}
