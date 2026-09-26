import { DEFAULT_LOADOUT, EquipmentId, Loadout } from "./Equipment"

const MAX_LIVES = 8

// 残機が1回復するのにかかる時間(ms)
export const LIFE_RECOVERY_INTERVAL_MS = 5 * 60 * 1000

// v2: Loadoutのsub装備を3枠から1枠に変更したため、古い保存形式と区別するためキーを変えている
const STORAGE_KEY = "danmaku-kari.playerData.v2"

type SerializedPlayerData = {
    stageClears: Record<string, EquipmentId[]>
    loadout: Loadout
    lives: number
    lastLivesSyncedAt: number
}

/**
 * ステージ間・シーン間で引き継がれるプレイヤーのセーブデータを保持する。
 * シングルトンとして使う。変更のたびにlocalStorageへ保存し、生成時に読み込む。
 */
export class PlayerData {
    // ステージID -> そのステージをクリアした際に使った主装備のID一覧
    private readonly stageClears = new Map<string, Set<EquipmentId>>()

    private loadout: Loadout = DEFAULT_LOADOUT

    private lives = MAX_LIVES

    // 残機回復の経過計算の基準時刻(ms epoch)。recoverLivesOverTimeを呼ぶたびに進める
    private lastLivesSyncedAt = Date.now()

    constructor() {
        this.load()
        this.recoverLivesOverTime()
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
            this.lives = data.lives
            this.lastLivesSyncedAt = data.lastLivesSyncedAt
        } catch {
            // 保存データが壊れている/存在しない場合は初期値のまま進める
        }
    }

    private save() {
        const data: SerializedPlayerData = {
            stageClears: Object.fromEntries([...this.stageClears].map(([stageId, equipmentIds]) => [stageId, [...equipmentIds]])),
            loadout: this.loadout,
            lives: this.lives,
            lastLivesSyncedAt: this.lastLivesSyncedAt,
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
            // 保存に失敗しても(容量超過/プライベートブラウジング等)ゲームは続行する
        }
    }
}

export const playerData = new PlayerData()
