import { DigitalInput, TouchTracker } from "@ipota/input"
import { Vec, vec } from "@ipota/vec"
import type { GameAction } from "./Game"

/**
 * タッチ操作をDigitalInput.Readerに見せかけるアダプタ。
 * 1本指ドラッグ = 移動(指の移動量をワールド座標のベクトルとしてそのまま速度に使う)+集中モード常時ON、
 * 2本指タップ = action、3本指タッチ = suicide。
 * キーボード/ゲームパッドの入力(base)にはORで重ねるので、両方同時に使っても壊れない。
 */
export class TouchControls implements DigitalInput.Reader<GameAction> {
    private readonly tracker: TouchTracker

    // 1本指ドラッグ中の移動量(ワールド座標)。ドラッグ中でなければundefined
    private touchMoveVector: Vec | undefined
    private isTouching = false

    private actionPushed = false
    private suicidePushed = false
    private prevTouchCount = 0

    constructor(
        private readonly base: DigitalInput.Reader<GameAction>,
        private readonly canvas: HTMLCanvasElement,
    ) {
        this.tracker = new TouchTracker(canvas)
    }

    /** 毎フレーム呼ぶこと。DigitalInput.Readerのインターフェースには無い、このクラス固有のメソッド */
    update() {
        const touchCount = this.tracker.touchesCount()

        // getDelta()自体は内部状態(前フレーム座標)更新のため、本数に関わらず毎フレーム呼び続ける
        const delta = this.tracker.getDelta()

        // 複数指ジェスチャー中の誤動作を防ぐため、1本指の時だけドラッグ移動として扱う
        if (touchCount === 1 && delta) {
            // canvasの内部解像度とCSS表示サイズの比率で、画面px単位のずれをワールド座標に変換する
            const scale = this.canvas.width / this.canvas.getBoundingClientRect().width
            this.touchMoveVector = vec(delta.x * scale, delta.y * scale)
        } else {
            this.touchMoveVector = undefined
        }

        this.isTouching = touchCount >= 1

        // 直前フレームと本数が変わった瞬間だけ発火するエッジ検出
        this.actionPushed = touchCount === 2 && this.prevTouchCount !== 2
        this.suicidePushed = touchCount === 3 && this.prevTouchCount !== 3
        this.prevTouchCount = touchCount
    }

    /** 1本指ドラッグ中の移動量(ワールド座標のベクトル)。ドラッグ中でなければundefined */
    getTouchMoveVector(): Vec | undefined {
        return this.touchMoveVector
    }

    isPressed(action: GameAction): boolean {
        if (action === "slow") return this.isTouching || this.base.isPressed(action)
        return this.base.isPressed(action)
    }

    isPushed(action: GameAction): boolean {
        switch (action) {
            case "action":
                return this.actionPushed || this.base.isPushed(action)
            case "suicide":
                return this.suicidePushed || this.base.isPushed(action)
            default:
                return this.base.isPushed(action)
        }
    }

    isReleased(action: GameAction): boolean {
        return this.base.isReleased(action)
    }

    isSomethingPressed(): boolean {
        return this.isTouching || this.base.isSomethingPressed()
    }

    isSomethingPushed(): boolean {
        return this.actionPushed || this.suicidePushed || this.base.isSomethingPushed()
    }

    isRepeatPushed(action: GameAction, intervalMs: number, initialDelayMs?: number): boolean {
        return this.base.isRepeatPushed(action, intervalMs, initialDelayMs)
    }
}
