import { DEFAULT_LOADOUT, EquipmentId, Loadout } from "./Equipment"

const INITIAL_LIVES = 8

// 残機回復に必要な時間(ms)。回復処理自体は未実装
export const LIFE_RECOVERY_INTERVAL_MS = 5 * 60 * 1000

const STORAGE_KEY = "danmaku-kari.playerData"

type SerializedPlayerData = {
    stageClears: Record<string, EquipmentId[]>
    loadout: Loadout
    lives: number
    lifeRecoveryElapsedMs: number
}

/**
 * ステージ間・シーン間で引き継がれるプレイヤーのセーブデータを保持する。
 * シングルトンとして使う。変更のたびにlocalStorageへ保存し、生成時に読み込む。
 */
export class PlayerData {
    // ステージID -> そのステージをクリアした際に使った主装備のID一覧
    private readonly stageClears = new Map<string, Set<EquipmentId>>()

    private loadout: Loadout = DEFAULT_LOADOUT

    private lives = INITIAL_LIVES

    // 次の残機回復までの経過時間(ms)
    private lifeRecoveryElapsedMs = 0

    constructor() {
        this.load()
    }

    recordStageClear(stageId: string, mainEquipmentId: EquipmentId) {
        const clearedWith = this.stageClears.get(stageId) ?? new Set()
        clearedWith.add(mainEquipmentId)
        this.stageClears.set(stageId, clearedWith)
        this.save()
    }

    isStageCleared(stageId: string): boolean {
        return this.stageClears.has(stageId)
    }

    getStageClearedMainEquipments(stageId: string): ReadonlySet<EquipmentId> {
        return this.stageClears.get(stageId) ?? new Set()
    }

    getLoadout(): Loadout {
        return this.loadout
    }

    setLoadout(loadout: Loadout) {
        this.loadout = loadout
        this.save()
    }

    getLives(): number {
        return this.lives
    }

    setLives(lives: number) {
        this.lives = lives
        this.save()
    }

    getLifeRecoveryElapsedMs(): number {
        return this.lifeRecoveryElapsedMs
    }

    setLifeRecoveryElapsedMs(ms: number) {
        this.lifeRecoveryElapsedMs = ms
        this.save()
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

            this.loadout = data.loadout
            this.lives = data.lives
            this.lifeRecoveryElapsedMs = data.lifeRecoveryElapsedMs
        } catch {
            // 保存データが壊れている/存在しない場合は初期値のまま進める
        }
    }

    private save() {
        const data: SerializedPlayerData = {
            stageClears: Object.fromEntries([...this.stageClears].map(([stageId, equipmentIds]) => [stageId, [...equipmentIds]])),
            loadout: this.loadout,
            lives: this.lives,
            lifeRecoveryElapsedMs: this.lifeRecoveryElapsedMs,
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
            // 保存に失敗しても(容量超過/プライベートブラウジング等)ゲームは続行する
        }
    }
}

export const playerData = new PlayerData()
