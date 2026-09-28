import { Game } from "../Game/Game"
import { EquipmentId } from "../Data/Equipment"
import { PlayerData } from "../Data/PlayerData"
import { Stage } from "../Stage/Stage"
import { JsonCanvas, JsonCanvasNode } from "./JsonCanvas"

export type MapNodeId = string

type StageModule = { default: new (game: Game) => Stage }

// ステージはファイル名(拡張子なし)で参照する。遅延読み込みなので、マップ画面では各ステージのコードを読み込まない。
// globのキーの形式(相対パスか絶対パスか)に依存しないよう、キーからファイル名だけを取り出して引く
// @ts-ignore: globの型定義が不正確で、import.meta.globの戻り値の型が正しく推論されない
const stageLoaders: ReadonlyMap<string, () => Promise<StageModule>> = new Map(
    // @ts-ignore: globの型定義が不正確で、import.meta.globの戻り値の型が正しく推論されない
    Object.entries(import.meta.glob<StageModule>(["../Stage/Stage*.ts", "!../Stage/Stage.ts"])).map(([path, load]) => [
        path.replace(/^.*\//, "").replace(/\.ts$/, ""),
        load,
    ]),
)

export class MapNode {
    constructor(
        // Canvasのカードのid。同じステージを複数のノードで使い回せるよう、ステージ名とは別に持つ
        readonly id: MapNodeId,
        readonly label: string,
        private readonly stageName: string,
        // ワールド座標(px)。原点や単位に意味はなく、ノード間の相対位置だけが重要
        readonly x: number,
        readonly y: number,
    ) {
        // 書き間違いにはマップ読み込みの時点で気づけるようにする(ステージに入ってから落ちるのを防ぐ)
        if (!stageLoaders.has(stageName)) {
            const available = [...stageLoaders.keys()].join(", ")
            throw new Error(
                `ステージのファイルが見つかりません: ${stageName} (ノード「${label}」)。候補: [${available}]`,
            )
        }
    }

    // カード本文の1行目をラベル、2行目をステージのファイル名として読む。座標はカードの中心
    static fromCanvas(card: JsonCanvasNode): MapNode {
        const [label = "", stageName = ""] = (card.text ?? "").split("\n").map((line) => line.trim())
        return new MapNode(card.id, label, stageName, card.x + card.width / 2, card.y + card.height / 2)
    }

    async stage(game: Game): Promise<Stage> {
        const { default: StageClass } = await stageLoaders.get(this.stageName)!()
        return new StageClass(game)
    }
}

export class MapEdge {
    constructor(
        readonly from: MapNode,
        readonly to: MapNode,
        // 指定した場合、反対側のノードをこの主装備でクリアしていないと、この辺を通っての解放はされない
        readonly requiredMainEquipmentId?: EquipmentId,
    ) {}

    connects(node: MapNode): boolean {
        return this.from === node || this.to === node
    }

    opposite(node: MapNode): MapNode {
        return this.from === node ? this.to : this.from
    }

    // この辺越しにnodeを解放できるか: 反対側のノードが、要求する主装備でクリア済みか(要求がなければクリア済みでよい)
    unlocks(node: MapNode, playerData: PlayerData): boolean {
        const opposite = this.opposite(node)
        if (!playerData.isStageCleared(opposite.id)) return false
        if (!this.requiredMainEquipmentId) return true

        return playerData.getStageClearedMainEquipments(opposite.id).has(this.requiredMainEquipmentId)
    }
}

export type MapBounds = { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number }

export class MapGraph {
    private readonly nodesById: ReadonlyMap<MapNodeId, MapNode>

    private constructor(
        readonly start: MapNode,
        readonly nodes: readonly MapNode[],
        readonly edges: readonly MapEdge[],
    ) {
        this.nodesById = new Map(nodes.map((node) => [node.id, node]))
    }

    // テキストカードだけをノードとして読む(グループなどは整理用として無視する)。
    // 辺のラベルは主装備の条件。スタート地点は、入ってくる辺が一本もない唯一のノード
    static fromCanvas(canvas: JsonCanvas): MapGraph {
        const nodes = canvas.nodes.filter((card) => card.type === "text").map((card) => MapNode.fromCanvas(card))
        const nodesById = new Map(nodes.map((node) => [node.id, node]))

        const findNode = (id: string): MapNode => {
            const node = nodesById.get(id)
            if (!node) throw new Error(`辺がテキストカード以外につながっています: ${id}`)
            return node
        }

        const edges = canvas.edges.map(
            (edge) => new MapEdge(findNode(edge.fromNode), findNode(edge.toNode), edge.label?.trim() || undefined),
        )

        const starts = nodes.filter((node) => !edges.some((edge) => edge.to === node))
        if (starts.length !== 1) {
            const labels = starts.map((node) => node.label).join(", ")
            throw new Error(`スタート地点(入ってくる辺がないノード)はちょうど1つ必要です: [${labels}]`)
        }

        return new MapGraph(starts[0]!, nodes, edges)
    }

    node(id: MapNodeId): MapNode {
        const node = this.nodesById.get(id)
        if (!node) throw new Error(`ノードが見つかりません: ${id}`)
        return node
    }

    neighbors(node: MapNode): MapNode[] {
        return this.edgesOf(node).map((edge) => edge.opposite(node))
    }

    // スタート地点は常に解放。それ以外は、隣接する辺のうち1つでも解放条件を満たしていれば解放される
    isUnlocked(node: MapNode, playerData: PlayerData): boolean {
        if (node === this.start) return true

        return this.edgesOf(node).some((edge) => edge.unlocks(node, playerData))
    }

    // 全ノードを囲む範囲
    bounds(): MapBounds {
        const xs = this.nodes.map((node) => node.x)
        const ys = this.nodes.map((node) => node.y)
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    }

    private edgesOf(node: MapNode): MapEdge[] {
        return this.edges.filter((edge) => edge.connects(node))
    }
}

export const mapGraph = MapGraph.fromCanvas(
    (await fetch("../../assets/MapData/MapData.canvas").then((r) => r.json())) as JsonCanvas,
)
