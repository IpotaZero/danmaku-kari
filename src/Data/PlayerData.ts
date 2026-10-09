import {
    DEFAULT_LOADOUT,
    DEFAULT_OWNED_MAIN_EQUIPMENT_IDS,
    DEFAULT_OWNED_SUB_EQUIPMENT_IDS,
    EquipmentId,
    Loadout,
} from "./Equipment"

const MAX_LIVES = 8

// 残機が1回復するのにかかる時間(ms)
export const LIFE_RECOVERY_INTERVAL_MS = 5

// v2: Loadoutのsub装備を3枠から1枠に変更したため、古い保存形式と区別するためキーを変えている
const STORAGE_KEY = "danmaku-kari.playerData.v2"

type SerializedPlayerData = {
    stageClears: Record<string, EquipmentId[]>
    loadout: Loadout
    ownedMainEquipmentIds?: EquipmentId[]
    ownedSubEquipmentIds?: EquipmentId[]
    lives: number
    lastLivesSyncedAt: number
    totalScore?: number
    badges?: BadgeId[]
    noMissClears?: string[]
    mapNodeId?: string
    debugUnlockAll?: boolean
}

// 免状(道場主を倒すと授かる証)のID
export type BadgeId = string

/**
 * ステージ間・シーン間で引き継がれるプレイヤーのセーブデータを保持する。
 * シングルトンとして使う。変更のたびにlocalStorageへ保存し、生成時に読み込む。
 */
export class PlayerData {
    // ステージID -> そのステージをクリアした際に使った主装備のID一覧
    private readonly stageClears = new Map<string, Set<EquipmentId>>()

    // 一度でもノーミスでクリアしたステージのID
    private readonly noMissClears = new Set<string>()

    // マップ画面で最後に選んでいたノードのID。まだマップを動いていなければundefined
    mapNodeId?: string

    private loadout: Loadout = DEFAULT_LOADOUT

    // 所持している装備のID一覧(主装備・副装備で別枠)。現状装備しているものは必ずここに含まれる
    private readonly ownedMainEquipmentIds = new Set<EquipmentId>(DEFAULT_OWNED_MAIN_EQUIPMENT_IDS)
    private readonly ownedSubEquipmentIds = new Set<EquipmentId>(DEFAULT_OWNED_SUB_EQUIPMENT_IDS)

    private lives = MAX_LIVES

    // 残機回復の経過計算の基準時刻(ms epoch)。recoverLivesOverTimeを呼ぶたびに進める
    private lastLivesSyncedAt = Date.now()

    // 各ステージで獲得したscoreの累計(ステージを跨いで引き継がれる)
    private totalScore = 0

    // 授かった免状
    private readonly badges = new Set<BadgeId>()

    // デバッグ用。trueならクリア状況に関係なく全ステージを解放する(MapGraph.isUnlocked参照)
    debugUnlockAll = false

    constructor() {
        this.load()
        this.recoverLivesOverTime()
    }

    recordStageClear(stageId: string, mainEquipmentId: EquipmentId, noMiss: boolean) {
        const clearedWith = this.stageClears.get(stageId) ?? new Set()
        clearedWith.add(mainEquipmentId)
        this.stageClears.set(stageId, clearedWith)
        if (noMiss) this.noMissClears.add(stageId)
        this.save()
    }

    isStageCleared(stageId: string): boolean {
        return this.stageClears.has(stageId)
    }

    isStageClearedWithoutMiss(stageId: string): boolean {
        return this.noMissClears.has(stageId)
    }

    moveOnMap(nodeId: string) {
        this.mapNodeId = nodeId
        this.save()
    }

    toggleDebugUnlockAll() {
        this.debugUnlockAll = !this.debugUnlockAll
        this.save()
    }

    getStageClearedMainEquipments(stageId: string): ReadonlySet<EquipmentId> {
        return this.stageClears.get(stageId) ?? new Set()
    }

    awardBadge(badge: BadgeId) {
        if (this.badges.has(badge)) return

        this.badges.add(badge)
        this.save()
    }

    hasBadge(badge: BadgeId): boolean {
        return this.badges.has(badge)
    }

    getBadges(): ReadonlySet<BadgeId> {
        return this.badges
    }

    getLoadout(): Loadout {
        return this.loadout
    }

    setLoadout(loadout: Loadout) {
        this.loadout = loadout
        this.save()
    }

    getOwnedMainEquipmentIds(): ReadonlySet<EquipmentId> {
        return this.ownedMainEquipmentIds
    }

    getOwnedSubEquipmentIds(): ReadonlySet<EquipmentId> {
        return this.ownedSubEquipmentIds
    }

    getMaxLives(): number {
        return MAX_LIVES
    }

    getLives(): number {
        return this.lives
    }

    // ステージ中の被弾などで残機が変化した際に呼び、値をそのまま引き継げるようにする
    setLives(lives: number) {
        this.lives = Math.min(MAX_LIVES, Math.max(0, lives))
        this.save()
    }

    getTotalScore(): number {
        return this.totalScore
    }

    // ステージクリア/ゲームオーバー時に、そのステージで稼いだscoreを累計へ加算する
    addScore(score: number) {
        this.totalScore += score
        this.save()
    }

    // 次に残機が1回復するまでの残り時間(ms)。満タンなら0
    getLifeRecoveryRemainingMs(now: number = Date.now()): number {
        if (this.lives >= MAX_LIVES) return 0
        return Math.max(0, LIFE_RECOVERY_INTERVAL_MS - (now - this.lastLivesSyncedAt))
    }

    // 経過した実時間に応じて残機を回復させる。呼ぶたびに現在時刻を基準に計算し直す
    recoverLivesOverTime(now: number = Date.now()) {
        if (this.lives >= MAX_LIVES) {
            this.lastLivesSyncedAt = now
            return
        }

        const recovered = Math.floor((now - this.lastLivesSyncedAt) / LIFE_RECOVERY_INTERVAL_MS)
        if (recovered <= 0) return

        this.lives = Math.min(MAX_LIVES, this.lives + recovered)
        this.lastLivesSyncedAt += recovered * LIFE_RECOVERY_INTERVAL_MS
        this.save()
    }

    // セーブデータを消し、初めて遊ぶときと同じ状態に戻す
    reset() {
        this.stageClears.clear()
        this.noMissClears.clear()
        this.mapNodeId = undefined
        this.loadout = DEFAULT_LOADOUT
        this.ownedMainEquipmentIds.clear()
        DEFAULT_OWNED_MAIN_EQUIPMENT_IDS.forEach((id) => this.ownedMainEquipmentIds.add(id))
        this.ownedSubEquipmentIds.clear()
        DEFAULT_OWNED_SUB_EQUIPMENT_IDS.forEach((id) => this.ownedSubEquipmentIds.add(id))
        this.lives = MAX_LIVES
        this.lastLivesSyncedAt = Date.now()
        this.totalScore = 0
        this.badges.clear()
        this.debugUnlockAll = false

        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            // localStorageが使えない環境では、メモリ上の状態を戻すだけにする
        }
    }

    private load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return

            const data: SerializedPlayerData = JSON.parse(raw)

            this.stageClears.clear()
            for (const [stageId, equipmentIds] of Object.entries(data.stageClears)) {
                this.stageClears.set(stageId, new Set(equipmentIds))
            }

            // 将来loadoutの形が変わっても、欠けたフィールドはデフォルトで補う
            this.loadout = { ...DEFAULT_LOADOUT, ...data.loadout }

            // 旧形式の保存データにはこのフィールドが無いので、その場合は初期所持のままにする
            if (data.ownedMainEquipmentIds) {
                this.ownedMainEquipmentIds.clear()
                data.ownedMainEquipmentIds.forEach((id) => this.ownedMainEquipmentIds.add(id))
            }
            if (data.ownedSubEquipmentIds) {
                this.ownedSubEquipmentIds.clear()
                data.ownedSubEquipmentIds.forEach((id) => this.ownedSubEquipmentIds.add(id))
            }

            this.lives = data.lives
            this.lastLivesSyncedAt = data.lastLivesSyncedAt
            // 旧形式の保存データにはこのフィールドが無いので、その場合は0から始める
            this.totalScore = data.totalScore ?? 0
            // 旧形式の保存データにはこのフィールドが無いので、その場合は免状なしから始める
            this.badges.clear()
            data.badges?.forEach((badge) => this.badges.add(badge))
            // 旧形式の保存データにはこのフィールドが無いので、その場合はノーミスクリアなしから始める
            this.noMissClears.clear()
            data.noMissClears?.forEach((stageId) => this.noMissClears.add(stageId))
            this.mapNodeId = data.mapNodeId
            this.debugUnlockAll = data.debugUnlockAll ?? false
        } catch {
            // 保存データが壊れている/存在しない場合は初期値のまま進める
        }
    }

    private save() {
        const data: SerializedPlayerData = {
            stageClears: Object.fromEntries(
                [...this.stageClears].map(([stageId, equipmentIds]) => [stageId, [...equipmentIds]]),
            ),
            loadout: this.loadout,
            ownedMainEquipmentIds: [...this.ownedMainEquipmentIds],
            ownedSubEquipmentIds: [...this.ownedSubEquipmentIds],
            lives: this.lives,
            lastLivesSyncedAt: this.lastLivesSyncedAt,
            totalScore: this.totalScore,
            badges: [...this.badges],
            noMissClears: [...this.noMissClears],
            mapNodeId: this.mapNodeId,
            debugUnlockAll: this.debugUnlockAll,
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
            // 保存に失敗しても(容量超過/プライベートブラウジング等)ゲームは続行する
        }
    }
}

export const playerData = new PlayerData()
