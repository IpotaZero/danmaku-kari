// 地図の日付。物語は初雪の七日前に始まり、初雪の日に終わる。日付は「初雪まであと何日か」で数える
export namespace Day {
    const KANJI = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]

    // ノードの日付。「五日前」「前日」「初雪」
    export function label(day: number): string {
        if (day === 0) return "初雪"
        if (day === 1) return "前日"
        return `${KANJI[day] ?? day}日前`
    }

    // 地図の隅に出す、今日の日付。「初雪まで あと五日」「初雪」
    export function countdown(day: number): string {
        if (day === 0) return "初雪"
        return `初雪まで あと${KANJI[day] ?? day}日`
    }
}
