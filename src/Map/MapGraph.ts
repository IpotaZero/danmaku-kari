import { Game } from "../Game/Game"
import { EquipmentId } from "../Data/Equipment"
import { PlayerData } from "../Data/PlayerData"
import { Stage } from "../Stage/Stage"

export type MapNodeId = string

export type MapNode = {
    readonly id: MapNodeId
    readonly label: string
    readonly description: string
    // ワールド座標(px)。原点や単位に意味はなく、ノード間の相対位置だけが重要
    readonly x: number
    readonly y: number
    readonly stage: (game: Game) => Promise<Stage>
}

export type MapEdge = {
    readonly from: MapNodeId
    readonly to: MapNodeId
    // 指定した場合、from/toどちらかをこの主装備でクリアしていないと、この辺を通っての解放はされない
    readonly requiredMainEquipmentId?: EquipmentId
}

export type MapGraph = {
    readonly startId: MapNodeId
    readonly nodes: readonly MapNode[]
    readonly edges: readonly MapEdge[]
}

// 仮のマップ
export const mapGraph: MapGraph = {
    startId: "start",
    nodes: [
        {
            id: "start",
            label: "難しさとは",
            description: "集中と混乱のこと",
            x: 0,
            y: 120,
            stage: async (game) => import("../Stage/StageTest").then(({ default: c }) => new c(game)),
        },
        {
            id: "a",
            label: "",
            description: "",
            x: 160,
            y: 0,
            stage: async (game) => import("../Stage/StageConstellation").then(({ default: c }) => new c(game)),
        },
        {
            id: "b",
            label: "",
            description: "",
            x: 160,
            y: 240,
            stage: async (game) => import("../Stage/StageFrost").then(({ default: c }) => new c(game)),
        },
        {
            id: "goal",
            label: "",
            description: "",
            x: 320,
            y: 120,
            stage: async (game) => import("../Stage/StageTest").then(({ default: c }) => new c(game)),
        },
    ],
    edges: [
        { from: "start", to: "a" },
        { from: "start", to: "b" },
        { from: "a", to: "goal" },
        { from: "b", to: "goal", requiredMainEquipmentId: "sub-weapon" },
    ],
}

export function getMapNode(id: MapNodeId): MapNode {
    const node = mapGraph.nodes.find((n) => n.id === id)
    if (!node) throw new Error(`ノードが見つかりません: ${id}`)
    return node
}

function getConnectedEdges(id: MapNodeId): MapEdge[] {
    return mapGraph.edges.filter((edge) => edge.from === id || edge.to === id)
}

export function getNeighborIds(id: MapNodeId): MapNodeId[] {
    return getConnectedEdges(id).map((edge) => (edge.from === id ? edge.to : edge.from))
}

// 辺越しに解放できるか: 反対側のノードが、辺の要求する主装備でクリア済みか(要求がなければクリア済みでよい)
function isEdgeUnlockable(edge: MapEdge, oppositeId: MapNodeId, playerData: PlayerData): boolean {
    if (!playerData.isStageCleared(oppositeId)) return false
    if (!edge.requiredMainEquipmentId) return true

    return playerData.getStageClearedMainEquipments(oppositeId).has(edge.requiredMainEquipmentId)
}

// スタート地点は常に解放。それ以外は、隣接する辺のうち1つでも解放条件を満たしていれば解放される。
export function isMapNodeUnlocked(node: MapNode, playerData: PlayerData): boolean {
    if (node.id === mapGraph.startId) return true

    return getConnectedEdges(node.id).some((edge) => {
        const oppositeId = edge.from === node.id ? edge.to : edge.from
        return isEdgeUnlockable(edge, oppositeId, playerData)
    })
}
