import { AnalogInput, DigitalInput, TouchTracker } from "@ipota/input"
import { Vec, vec } from "@ipota/vec"
import type { GameAction } from "./Game"

/**
 * タッチ操作をDigitalInput.Reader/AnalogInput.Readerに見せかけるアダプタ。
 * 1本指ドラッグ = 移動(指の移動量をワールド座標のベクトルとしてそのまま速度に使う)+集中モード常時ON、
 * 2本指タップ = action、3本指タッチ = suicide。
 * キーボード/ゲームパッドの入力(base)にはORで重ねるので、両方同時に使っても壊れない。
 *
 * 移動は「最初に触れた指」1本のみを追跡し、action/suicide用に指が増えても継続する
 * (指の本数だけで判定すると、action目的の2本目タップのたびに移動が中断されてしまうため)。
 */
export class TouchControls implements DigitalInput.Reader<GameAction>, AnalogInput.Reader<GameAction> {
    private readonly tracker: TouchTracker

    // 1本指ドラッグ中の移動量(ワールド座標)。ドラッグ中でなければundefined
    private touchMoveVector: Vec | undefined
    private isTouching = false

    private actionPushed = false
    private suicidePushed = false
    private prevTouchCount = 0

    // 移動に使っている指のidentifierと直前の座標。他の指が増減してもこの指が離れるまで移動を続ける
    private dragTouchId: number | undefined
    private dragPrevPos: Vec | undefined

    constructor(
        private readonly base: DigitalInput.Reader<GameAction>,
        private readonly analogBase: AnalogInput.Reader<GameAction>,
        private readonly canvas: HTMLCanvasElement,
    ) {
        this.tracker = new TouchTracker(canvas)
    }

    /** 毎フレーム呼ぶこと。DigitalInput.Readerのインターフェースには無い、このクラス固有のメソッド */
    update() {
        const touches = this.tracker.getCurrentTouches()
        const touchCount = touches?.length ?? 0

        this.touchMoveVector = this.updateDrag(touches)
        this.isTouching = touchCount >= 1

        // 直前フレームと本数が変わった瞬間だけ発火するエッジ検出
        this.actionPushed = touchCount === 2 && this.prevTouchCount !== 2
        this.suicidePushed = touchCount === 3 && this.prevTouchCount !== 3
        this.prevTouchCount = touchCount
    }

    private updateDrag(touches: TouchList | undefined): Vec | undefined {
        if (!touches || touches.length === 0) {
            this.dragTouchId = undefined
            this.dragPrevPos = undefined
            return undefined
        }

        const current =
            this.dragTouchId !== undefined
                ? Array.from(touches).find((t) => t.identifier === this.dragTouchId)
                : undefined

        // 追跡していた指が見つからない(まだ決めていない、または離れた)場合、
        // 残っている指のうち最初のものを新たに移動用として採用する。
        // このフレームは基準座標を取り直すだけで、移動量は返さない(指の乗り換えで飛ばないように)
        if (!current) {
            const t = touches[0]
            this.dragTouchId = t.identifier
            this.dragPrevPos = vec(t.clientX, t.clientY)
            return undefined
        }

        // canvasの内部解像度とCSS表示サイズの比率で、画面px単位のずれをワールド座標に変換する
        const scale = this.canvas.width / this.canvas.getBoundingClientRect().width
        const pos = vec(current.clientX, current.clientY)
        const vector = pos.sub(this.dragPrevPos!).scale(scale)
        this.dragPrevPos = pos
        return vector
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

    // タッチの移動はgetTouchMoveVectorで別に渡すので、アナログ値はキーボード/ゲームパッドのものをそのまま返す
    getValue(action: GameAction): number {
        return this.analogBase.getValue(action)
    }

    // タッチ由来のこのフレームの押下も一緒に忘れる。指の本数(prevTouchCount)は残し、触れたままでも再発火しないようにする
    clear() {
        this.actionPushed = false
        this.suicidePushed = false
        this.base.clear()
    }
}
