// Obsidian Canvas の保存形式(JSON Canvas)のうち、マップの読み込みに使う部分だけの型
// 仕様: https://jsoncanvas.org/

export type JsonCanvasNode = {
    readonly id: string
    readonly type: "text" | "file" | "link" | "group"
    readonly text?: string
    // カードの左上の座標と大きさ
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

export type JsonCanvasEdge = {
    readonly id: string
    readonly fromNode: string
    readonly toNode: string
    readonly label?: string
}

export type JsonCanvas = {
    readonly nodes: readonly JsonCanvasNode[]
    readonly edges: readonly JsonCanvasEdge[]
}
