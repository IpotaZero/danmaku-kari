// 効果音1つ分。呼び出されるたびに、鳴っている途中でも止めて最初から再生しなおす
export class Sound {
    private buffer?: AudioBuffer
    private source?: AudioBufferSourceNode
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
