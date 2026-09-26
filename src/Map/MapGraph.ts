import { Game } from "../Game/Game"
import { Stage } from "../Stage/Stage"
import StageTest from "../Stage/StageTest"

export type MapNodeId = string

export type MapNode = {
    readonly id: MapNodeId
    readonly label: string
    readonly description: string
    // 画面内の位置(%, 0-100)
    readonly x: number
    readonly y: number
    readonly stage: (game: Game) => Stage
}

export type MapEdge = readonly [MapNodeId, MapNodeId]

export type MapGraph = {
    readonly nodes: readonly MapNode[]
    readonly edges: readonly MapEdge[]
}

// とりあえず全ノードをStageTestに紐づけておく
export const mapGraph: MapGraph = {
    nodes: [
        { id: "start", label: "start", description: "はじまりの地点", x: 20, y: 50, stage: (game) => new StageTest(game) },
        { id: "a", label: "A", description: "分岐A", x: 50, y: 25, stage: (game) => new StageTest(game) },
        { id: "b", label: "B", description: "分岐B", x: 50, y: 75, stage: (game) => new StageTest(game) },
        { id: "goal", label: "goal", description: "最終地点", x: 80, y: 50, stage: (game) => new StageTest(game) },
    ],
    edges: [
        ["start", "a"],
        ["start", "b"],
        ["a", "goal"],
        ["b", "goal"],
    ],
}
