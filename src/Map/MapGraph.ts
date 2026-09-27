import { Game } from "../Game/Game"
import { EquipmentId } from "../Data/Equipment"
import { PlayerData } from "../Data/PlayerData"
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
// とりあえず全ノードをStageTestに紐づけておく。requiredMainEquipmentIdの値も仮
export const mapGraph: MapGraph = {
    startId: "start",
    nodes: [
        {
            id: "start",
            label: "難しさとは",
            description: "集中と混乱のこと",
            x: 20,
            y: 50,
            stage: (game) => new StageTest(game),
        },
        { id: "a", label: "A", description: "分岐A", x: 50, y: 25, stage: (game) => new StageTest(game) },
        { id: "b", label: "B", description: "分岐B", x: 50, y: 75, stage: (game) => new StageTest(game) },
        { id: "goal", label: "goal", description: "最終地点", x: 80, y: 50, stage: (game) => new StageTest(game) },
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
