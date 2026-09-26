import type { DigitalInput } from "@ipota/input"
import type { LessThan } from "@ipota/my-utils"
import { GenUtils } from "./Functions/GeneratorUtils"

export interface TalkConfig {
    name?: string
    /** 1文字あたりの表示に要するフレーム数（既定値: 2） */
    charInterval?: number
    canSkip?: boolean
}

// --- 1. 返り値の型定義 (type プロパティによる XOR / 判別共用体) ---
export type AskSelectResult<Length extends number> = {
    type: "select"
    index: LessThan<Length>
}

export type AskCancelResult = {
    type: "cancel"
}

export type AskTimeoutResult = {
    type: "timeout"
}

// --- 2. オプションと型推論 ---
export interface AskOptions {
    /** 質問タイトル・メッセージ（例: "ほんとに？"） */
    title?: string
    /** キャンセル操作 (cancelキー) を許可するか */
    cancelable?: boolean
    /** タイムアウトまでのフレーム数 (未指定の場合は無制限) */
    timeoutFrame?: number
}

export type AskResult<Length extends number, O extends AskOptions> =
    | AskSelectResult<Length>
    | (O["cancelable"] extends true ? AskCancelResult : never)
    | (O["timeoutFrame"] extends number ? AskTimeoutResult : never)

// --- 3. TextBox クラス ---
export class TextBox {
    readonly box = document.createElement("div")
    private readonly name: HTMLElement
    private readonly text: HTMLElement
    private readonly option: HTMLElement
    private readonly timer: HTMLElement

    constructor(
        private readonly input: DigitalInput.Reader<"ok" | "cancel" | "up" | "down" | "right" | "left">,
        private readonly playSe: () => void,
    ) {
        this.box.innerHTML = `
            <div class="name"></div>
            <div class="text"></div>
            <div class="option"></div>
            <div class="timer-bar"><div class="timer-fill"></div></div>
        `
        this.name = this.box.querySelector(".name") as HTMLElement
        this.text = this.box.querySelector(".text") as HTMLElement
        this.option = this.box.querySelector(".option") as HTMLElement
        this.timer = this.box.querySelector(".timer-fill") as HTMLElement
        this.box.classList.add("hidden", "text-box")
    }

    dispose() {
        this.box.remove()
    }

    hide() {
        this.box.classList.add("hidden")
    }

    *say(texts: readonly string[], config: TalkConfig = {}) {
        this.reset()
        this.show()

        for (const text of texts) {
            yield* this.saySingle(text, config)
            yield
        }

        this.box.classList.add("hidden")
        yield
    }

    /**
     * 選択肢を表示して入力を待つ
     */
    *ask<Length extends number, O extends AskOptions = AskOptions>(
        options: readonly string[] & { length: Length },
        { cancelable = false, title, timeoutFrame }: O = {} as O,
    ): Generator<void, AskResult<Length, O>, void> {
        this.reset()
        this.show()

        // タイトルが指定されていればテキスト領域にセット
        if (title) {
            this.text.innerHTML = title
        }

        this.option.innerHTML = options.map((opt) => `<span>${opt}</span>`).join("")

        // 1. 競争させるジェネレータのオブジェクトを作成
        const tasks = {
            selection: this.waitSelection(options),
            cancel: cancelable ? this.waitCancel() : this.never(),
            timeout: timeoutFrame ? this.waitTimer(timeoutFrame) : this.never(),
        }

        // 2. GenUtils.race で最初に完了した方の結果を取得
        const result = yield* GenUtils.race(tasks)

        this.box.classList.add("hidden")

        if (result.key === "selection") {
            return result.value as AskResult<Length, O>
        } else if (result.key === "cancel") {
            return { type: "cancel" } as AskResult<Length, O>
        } else if (result.key === "timeout") {
            return { type: "timeout" } as AskResult<Length, O>
        }

        throw new Error()
    }

    private *never(): Generator<void, never, void> {
        while (true) yield
    }

    /**
     * ユーザーのキー選択入力を待つジェネレータ
     */
    private *waitSelection<Length extends number>(
        options: readonly string[] & { length: Length },
    ): Generator<void, AskSelectResult<Length>, void> {
        let index = 0
        this.selectOption(index)

        yield

        while (true) {
            if (this.input.isPushed("ok")) {
                this.playSe()
                return { type: "select", index: index as LessThan<Length> }
            }

            if (this.input.isPushed("right")) {
                this.playSe()
                index = (index + 1) % options.length
                this.selectOption(index)
            } else if (this.input.isPushed("left")) {
                this.playSe()
                index = (index + options.length - 1) % options.length
                this.selectOption(index)
            }

            yield
        }
    }

    private *waitCancel(): Generator<void, AskCancelResult, void> {
        while (!this.input.isPushed("cancel")) yield
        yield
        return { type: "cancel" }
    }

    /**
     * タイムアウトゲージを描画しながら時間をカウントするジェネレータ
     */
    private *waitTimer(frames: number): Generator<void, AskTimeoutResult, void> {
        const timerBar = this.box.querySelector(".timer-bar") as HTMLElement
        if (timerBar) timerBar.classList.remove("hidden")

        for (let f = 0; f < frames; f++) {
            const ratio = (frames - f) / frames
            this.timer.style.width = `${ratio * 100}%`
            yield
        }

        this.playSe()
        return { type: "timeout" }
    }

    private reset() {
        this.box.classList.add("hidden")
        this.box.classList.remove("text-box--done")
        this.name.innerText = ""
        this.name.classList.add("hidden")
        this.text.innerText = ""
        this.option.innerHTML = ""
        this.timer.style.width = "100%"
        const timerBar = this.box.querySelector(".timer-bar") as HTMLElement
        if (timerBar) timerBar.classList.add("hidden")
    }

    private selectOption(num: number) {
        this.option.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"))
        this.option.querySelector(`:nth-child(${num + 1})`)?.classList.add("selected")
    }

    private *saySingle(text: string, { name = "", charInterval = 2, canSkip = true }: TalkConfig) {
        this.name.innerHTML = name
        this.name.classList.toggle("hidden", name === "")
        this.text.innerHTML = ""

        this.box.classList.remove("text-box--done")
        this.box.classList.add("text-box--typing")

        yield* this.typeText(text, charInterval, canSkip)

        this.box.classList.remove("text-box--typing")
        this.box.classList.add("text-box--done")

        yield* this.wait()
    }

    private *typeText(text: string, interval: number, canSkip: boolean) {
        const tokens = text.match(/<[^>]+>|[\s\S]/g) ?? []
        let revealed = ""

        for (const token of tokens) {
            revealed += token
            this.text.innerHTML = revealed

            if (token.startsWith("<")) continue

            if (token.trim() !== "") {
                this.playSe()
            }

            for (let f = 0; f < interval; f++) {
                yield

                if (canSkip && (this.input.isPushed("ok") || this.input.isPushed("cancel"))) {
                    this.text.innerHTML = text
                    yield
                    return
                }
            }
        }
    }

    private *wait() {
        while (!(this.input.isPushed("ok") || this.input.isPushed("cancel"))) yield
        yield
    }

    /**
     * テキストボックスを表示し、fadeIn アニメーションを再発火させる
     */
    private show() {
        this.box.classList.remove("hidden")

        // CSS アニメーションを一度リセットして強制リフロー（再描画）を起こす
        this.box.style.animation = "none"
        void this.box.offsetWidth // 強制リフロー
        this.box.style.animation = ""
    }
}
