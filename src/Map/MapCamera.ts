import type { MapBounds } from "./MapGraph"

type Point = { x: number; y: number }

// これ以上動かしたらタップではなくスワイプ(ドラッグ)とみなす閾値(px)
const DRAG_THRESHOLD = 6

// ノード選択時、そのノードが画面中央に来るまでのカメラ移動にかける時間
const PAN_MS = 250

// 地図を映すカメラ。ワールド本体と、方眼・紙の質感などの背景(layers)をすべて同じtransformで動かすので、背景がワールドから遅れることがない。
// 指一本のスワイプで動かし、指二本のピンチで拡大縮小する(拡大率はzoomRangeの中に収める)
export class MapCamera {
    // ワールド座標系でのカメラ位置(=画面中央に表示されるワールド座標)
    private pos: Point = { x: 0, y: 0 }
    private zoom = 1

    // 画面に触れている指(マウスなら左ボタン)ごとの現在位置(client座標)
    private readonly pointers = new Map<number, Point>()
    // 今の指の組み合わせになった時点の状態。指が増えたり減ったりするたびに、その時点から測り直す
    private gesture = {
        screenCenter: { x: 0, y: 0 },
        center: { x: 0, y: 0 },
        spread: 0,
        pos: { x: 0, y: 0 },
        zoom: 1,
    }

    // 指を置いてから、タップではなくスワイプ・ピンチになったか。
    // 指を離した直後に発火するclickをタップ選択と誤認しないよう、次に指を置くまで残す
    dragged = false

    constructor(
        private readonly root: HTMLElement,
        private readonly layers: readonly HTMLElement[],
        // カメラが動ける範囲(全ノードの範囲)。スワイプで無の空間へ延々と行けてしまわないようにする
        private readonly bounds: MapBounds,
        private readonly zoomRange: { readonly min: number; readonly max: number },
        // スワイプ・ピンチを受け付けてよいか(全体図などが被さっている間は動かさない)
        private readonly movable: () => boolean,
    ) {
        // 背景はカメラが動ける範囲+いちばん縮小したときに映る広さを覆う大きさにする(map.cssの.map-backdrop参照)
        root.style.setProperty("--world-min-x", `${bounds.minX}px`)
        root.style.setProperty("--world-min-y", `${bounds.minY}px`)
        root.style.setProperty("--world-width", `${bounds.maxX - bounds.minX}px`)
        root.style.setProperty("--world-height", `${bounds.maxY - bounds.minY}px`)
        root.style.setProperty("--map-min-zoom", `${zoomRange.min}`)

        root.addEventListener("pointerdown", (e) => this.handlePointerDown(e))
        root.addEventListener("pointermove", (e) => this.handlePointerMove(e))
        root.addEventListener("pointerup", (e) => this.handlePointerUp(e))
        root.addEventListener("pointercancel", (e) => this.handlePointerUp(e))
    }

    // ワールド座標posが画面中央に来るようにカメラを向ける。animateがtrueならアニメーションさせる
    lookAt(pos: Point, animate: boolean) {
        this.pos = this.clampToBounds(pos)
        this.apply(animate)
    }

    // 拡大縮小の中心は画面中央(map.cssで各layerのtransform-originをそこに合わせている)
    private apply(animate: boolean) {
        for (const el of this.layers) {
            el.style.transition = animate ? `transform ${PAN_MS}ms ease-out` : "none"
            el.style.transform = `scale(${this.zoom}) translate(${-this.pos.x}px, ${-this.pos.y}px)`
        }
    }

    private clampToBounds(pos: Point): Point {
        return {
            x: MapCamera.clamp(pos.x, this.bounds.minX, this.bounds.maxX),
            y: MapCamera.clamp(pos.y, this.bounds.minY, this.bounds.maxY),
        }
    }

    private handlePointerDown(e: PointerEvent) {
        if (this.pointers.size === 0) this.dragged = false
        if (!this.movable()) return
        if (e.button !== 0) return // 左クリック/タッチのみ(右クリック等でのドラッグ開始を防ぐ)

        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        this.restartGesture()
    }

    private handlePointerMove(e: PointerEvent) {
        if (!this.pointers.has(e.pointerId)) return
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

        const center = this.center()
        const { screenCenter, spread, pos, zoom } = this.gesture

        if (!this.dragged) {
            // 指一本ならしばらくはタップとみなして動かさない。指二本はその時点でピンチとみなす
            const moved = Math.hypot(center.x - this.gesture.center.x, center.y - this.gesture.center.y)
            if (this.pointers.size === 1 && moved < DRAG_THRESHOLD) return
            this.dragged = true
            this.root.classList.add("dragging")
        }

        // 指を置いた時点で指の中心にあったワールド座標が、いまの指の中心に来続けるようにする。
        // 指の開き具合が変わったら、その比だけ拡大縮小する
        const anchor = {
            x: pos.x + (this.gesture.center.x - screenCenter.x) / zoom,
            y: pos.y + (this.gesture.center.y - screenCenter.y) / zoom,
        }
        this.zoom = spread > 0 ? MapCamera.clamp((zoom * this.spread()) / spread, this.zoomRange.min, this.zoomRange.max) : zoom
        this.pos = this.clampToBounds({
            x: anchor.x - (center.x - screenCenter.x) / this.zoom,
            y: anchor.y - (center.y - screenCenter.y) / this.zoom,
        })
        this.apply(false)
    }

    private handlePointerUp(e: PointerEvent) {
        if (!this.pointers.delete(e.pointerId)) return

        if (this.pointers.size > 0) {
            // ピンチの指を一本離しても、残った指でそのまま動かし続けられるようにする
            this.restartGesture()
            return
        }

        this.root.classList.remove("dragging")
    }

    private restartGesture() {
        const rect = this.root.getBoundingClientRect()
        this.gesture = {
            screenCenter: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            center: this.center(),
            spread: this.spread(),
            pos: this.pos,
            zoom: this.zoom,
        }
    }

    // 触れている指の中心
    private center(): Point {
        const points = [...this.pointers.values()]
        return {
            x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
            y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
        }
    }

    // 指の開き具合(中心からの平均距離)。指一本なら0
    private spread(): number {
        const center = this.center()
        const points = [...this.pointers.values()]
        return points.reduce((sum, p) => sum + Math.hypot(p.x - center.x, p.y - center.y), 0) / points.length
    }

    private static clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max)
    }
}
