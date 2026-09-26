import { DEFAULT_LOADOUT, EquipmentId, Loadout } from "./Equipment"

const INITIAL_LIVES = 8

// 残機回復に必要な時間(ms)。回復処理自体は未実装
export const LIFE_RECOVERY_INTERVAL_MS = 5 * 60 * 1000

/**
 * ステージ間・シーン間で引き継がれるプレイヤーのセーブデータを保持する。
 * シングルトンとして使う。
 */
export class PlayerData {
    // ステージID -> そのステージをクリアした際に使った主装備のID一覧
    private readonly stageClears = new Map<string, Set<EquipmentId>>()

    private loadout: Loadout = DEFAULT_LOADOUT

    private lives = INITIAL_LIVES

    // 次の残機回復までの経過時間(ms)
    private lifeRecoveryElapsedMs = 0

    recordStageClear(stageId: string, mainEquipmentId: EquipmentId) {
        const clearedWith = this.stageClears.get(stageId) ?? new Set()
        clearedWith.add(mainEquipmentId)
        this.stageClears.set(stageId, clearedWith)
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
    }

    getLives(): number {
        return this.lives
    }

    setLives(lives: number) {
        this.lives = lives
    }

    getLifeRecoveryElapsedMs(): number {
        return this.lifeRecoveryElapsedMs
    }

    setLifeRecoveryElapsedMs(ms: number) {
        this.lifeRecoveryElapsedMs = ms
    }
}

export const playerData = new PlayerData()
