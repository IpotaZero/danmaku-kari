import { Game } from "../Game/Game"
import { EquipmentId } from "../Data/Equipment"
import { BadgeId, PlayerData } from "../Data/PlayerData"
import { Stage } from "../Stage/Stage"
import { EdgeCondition } from "./EdgeCondition"
import { JsonCanvas, JsonCanvasNode } from "./JsonCanvas"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"
import { Scenery } from "../World/Scenery"

// ノード間の距離の倍率。スマホは画面が狭いので、ノードの大きさはそのままに間隔だけ詰めて周りまで見えるようにする
const POSITION_SCALE = isSmartPhone ? 0.5 : 1

// マップの定義ファイル(Obsidian Canvas)。実行時に取得する。
// new URL(..., import.meta.url)の形で書くと、Viteがビルド時にファイルを出力し、URLを書き換えてくれる
const MAP_URL = new URL("../../assets/MapData/MapData.canvas", import.meta.url).href

export type MapNodeId = string

type StageModule = { default: new (game: Game) => Stage }

// path はStageフォルダからの相対パス(拡張子なし)。最初のフォルダ名がステージのある場所(景色)になる
type StageLoader = { readonly path: string; readonly load: () => Promise<StageModule> }

// ステージはStageフォルダからの相対パス(拡張子なし)で参照する。同名ファイルがなければファイル名だけでも参照できる。
// ファイル名の末尾の全角括弧は覚え書き(「StageByakko（もっと難しく）」など)なので、参照するときは外す。
// 遅延読み込みなので、マップ画面では各ステージのコードを読み込まない。
const stageLoaders: ReadonlyMap<string, StageLoader> = (() => {
    // @ts-ignore
    const modules: Record<string, () => Promise<StageModule>> = import.meta.glob<StageModule>("../Stage/**/*.ts")
    const loaders = new Map<string, StageLoader>()
    const pathsByName = new Map<string, string[]>()
    for (const [path, load] of Object.entries(modules)) {
        const stagePath = path
            .replace(/^.*\/Stage\//, "")
            .replace(/\.ts$/, "")
            .replace(/（[^（）]*）$/, "")
        const name = stagePath.replace(/^.*\//, "")
        loaders.set(stagePath, { path: stagePath, load })
        const paths = pathsByName.get(name) ?? []
        paths.push(stagePath)
        pathsByName.set(name, paths)
    }
    for (const [name, paths] of pathsByName) {
        if (paths.length === 1) loaders.set(name, loaders.get(paths[0]!)!)
    }
    return loaders
})()

// ステージのファイルが見つからないノードでは、代わりにこのステージを遊ばせる
const MISSING_STAGE_NAME = "Test/StageNotImplemented"

export class MapNode {
    private readonly loader: StageLoader

    // ステージのある場所の景色。ステージのフォルダで決まる
    readonly scenery: Scenery

    constructor(
        // Canvasのカードのid。同じステージを複数のノードで使い回せるよう、ステージ名とは別に持つ
        readonly id: MapNodeId,
        readonly label: string,
        stageName: string,
        // ワールド座標(px)。原点や単位に意味はなく、ノード間の相対位置だけが重要
        readonly x: number,
        readonly y: number,
        // 見た目の大きさ(px)。Canvasのカードの大きさをそのまま使う
        readonly width: number,
        readonly height: number,
        // クリアすると授かる免状。道場主のノードにだけ付く
        readonly badge?: BadgeId,
    ) {
        // 見つからなくてもマップ全体は遊べるよう止めずに代わりのステージにする。書き間違いには読み込み時点の警告で気づけるようにする
        const loader = stageLoaders.get(stageName)
        if (!loader) {
            const available = [...stageLoaders.keys()].join(", ")
            console.warn(
                `ステージのファイルが見つかりません: ${stageName} (ノード「${label}」)。${MISSING_STAGE_NAME}で代用します。候補: [${available}]`,
            )
        }
        this.loader = loader ?? stageLoaders.get(MISSING_STAGE_NAME)!
        this.scenery = Scenery.ofArea(this.loader.path.split("/")[0]!)
    }

    // カード本文の1行目をラベル、2行目をステージの相対パスまたは一意なファイル名として読む。座標はカードの中心。
    // 3行目以降は「キー:値」の形の追加情報(今のところ免状を授ける"badge"だけ)
    static fromCanvas(card: JsonCanvasNode): MapNode {
        const [label = "", stageName = "", ...rest] = (card.text ?? "").split("\n").map((line) => line.trim())

        let badge: BadgeId | undefined
        for (const line of rest.filter((line) => line.length > 0)) {
            const [key = "", ...value] = line.split(":")
            if (key.trim() !== "badge") throw new Error(`不明な追加情報です: ${line} (ノード「${label}」)`)
            badge = value.join(":").trim()
        }

        const x = (card.x + card.width / 2) * POSITION_SCALE
        const y = (card.y + card.height / 2) * POSITION_SCALE
        return new MapNode(card.id, label, stageName, x, y, card.width / 2, card.height / 2, badge)
    }

    // クリアを記録し、免状を授けるノードなら免状も授ける
    recordClear(playerData: PlayerData, mainEquipmentId: EquipmentId, noMiss: boolean) {
        playerData.recordStageClear(this.id, mainEquipmentId, noMiss)
        if (this.badge) playerData.awardBadge(this.badge)
    }

    async stage(game: Game): Promise<Stage> {
        const { default: StageClass } = await this.loader.load()
        return new StageClass(game)
    }
}

export class MapEdge {
    constructor(
        readonly from: MapNode,
        readonly to: MapNode,
        readonly condition: EdgeCondition,
    ) {}

    // カーソル移動用。解放とは違い、辺は両方向にたどれる
    connects(node: MapNode): boolean {
        return this.from === node || this.to === node
    }

    opposite(node: MapNode): MapNode {
        return this.from === node ? this.to : this.from
    }

    // 解放は矢印の向きにだけ伝わる: fromがクリア済みで、かつ辺の条件を満たしていればtoを解放する
    isOpen(playerData: PlayerData): boolean {
        return playerData.isStageCleared(this.from.id) && this.condition.isMet(this.from, playerData)
    }
}

export type MapBounds = { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number }

export class MapGraph {
    // 取得は一度だけ行い、以降は同じ結果を返す
    private static loading?: Promise<MapGraph>

    private readonly nodesById: ReadonlyMap<MapNodeId, MapNode>

    private constructor(
        readonly start: MapNode,
        readonly nodes: readonly MapNode[],
        readonly edges: readonly MapEdge[],
    ) {
        this.nodesById = new Map(nodes.map((node) => [node.id, node]))
    }

    static load(): Promise<MapGraph> {
        MapGraph.loading ??= MapGraph.fetchCanvas().catch((error: unknown) => {
            // 失敗を覚えておくと二度と読み込めなくなるので、次の呼び出しで取得し直せるようにする
            MapGraph.loading = undefined
            throw error
        })
        return MapGraph.loading
    }

    private static async fetchCanvas(): Promise<MapGraph> {
        const response = await fetch(MAP_URL)
        if (!response.ok) throw new Error(`マップを読み込めません: ${MAP_URL} (${response.status})`)

        return MapGraph.fromCanvas((await response.json()) as JsonCanvas)
    }

    // テキストカードだけをノードとして読む(グループなどは整理用として無視する)。
    // 辺のラベルは解放の条件(EdgeCondition.fromLabel)。スタート地点は、入ってくる辺が一本もない唯一のノード
    static fromCanvas(canvas: JsonCanvas): MapGraph {
        const nodes = canvas.nodes.filter((card) => card.type === "text").map((card) => MapNode.fromCanvas(card))
        const nodesById = new Map(nodes.map((node) => [node.id, node]))
        const badges = new Set(nodes.flatMap((node) => (node.badge ? [node.badge] : [])))

        const findNode = (id: string): MapNode => {
            const node = nodesById.get(id)
            if (!node) throw new Error(`辺がテキストカード以外につながっています: ${id}`)
            return node
        }

        const edges = canvas.edges.map(
            (edge) =>
                new MapEdge(
                    findNode(edge.fromNode),
                    findNode(edge.toNode),
                    EdgeCondition.fromLabel(edge.label?.trim() || undefined, badges),
                ),
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

    // スタート地点は常に解放。それ以外は、入ってくる辺のうち1つでも開いていれば解放される(デバッグ用の全解放中は無条件)
    isUnlocked(node: MapNode, playerData: PlayerData): boolean {
        if (node === this.start || playerData.debugUnlockAll) return true

        return this.edges.filter((edge) => edge.to === node).some((edge) => edge.isOpen(playerData))
    }

    // 塊。同じ景色のノードが辺でつながったまとまり(地図の上の、ひとつの場所)
    clusters(): MapNode[][] {
        // それぞれのノードの属する塊の代表。同じ景色どうしの辺でつながったノードを、同じ代表にまとめていく
        const leader = new Map(this.nodes.map((node) => [node, node]))
        const find = (node: MapNode): MapNode => {
            const parent = leader.get(node)!
            return parent === node ? node : find(parent)
        }
        for (const edge of this.edges) {
            if (edge.from.scenery === edge.to.scenery) leader.set(find(edge.from), find(edge.to))
        }

        const clusters = new Map<MapNode, MapNode[]>()
        for (const node of this.nodes) {
            const cluster = clusters.get(find(node)) ?? []
            cluster.push(node)
            clusters.set(find(node), cluster)
        }
        return [...clusters.values()]
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
