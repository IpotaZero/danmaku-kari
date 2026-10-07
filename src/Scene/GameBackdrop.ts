import { Silhouette } from "../utils/Silhouette"

/**
 * 戦闘画面の、キャンバスの外側(左右の余白)に敷く夜の草むら。
 * キャンバスの後ろに置くだけなので、見えるのはキャンバスからはみ出た部分だけになる。
 * プレイの邪魔にならないよう、動きはどれもゆっくり・暗めにしてある。色と動きはCSS(game-backdrop.css)に任せる。
 */
export class GameBackdrop {
    readonly element = document.createElement("div")

    constructor() {
        this.element.className = "game-backdrop"
        this.element.innerHTML = `
            <div class="backdrop-moon"></div>
            <svg class="backdrop-branch backdrop-branch-right" viewBox="0 0 400 260">
                <g transform="translate(400 0) scale(-1 1)">${Silhouette.branch(14)}</g>
            </svg>
            <svg class="backdrop-branch backdrop-branch-left" viewBox="0 0 400 260">${Silhouette.branch(10)}</svg>
            <svg class="backdrop-grass backdrop-grass-back" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
                ${Silhouette.grass(140, 80, 0)}
            </svg>
            <svg class="backdrop-grass backdrop-grass-front" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
                ${Silhouette.grass(100, 120, 10)}
            </svg>
        `

        for (let i = 0; i < 24; i++) {
            const firefly = document.createElement("div")
            firefly.className = "backdrop-firefly"
            firefly.style.setProperty("--x", `${Math.random() * 100}%`)
            // 草むらの上あたりに多く集める
            firefly.style.setProperty("--y", `${45 + Math.random() * 50}%`)
            firefly.style.setProperty("--dx", `${(Math.random() - 0.5) * 8}rem`)
            firefly.style.setProperty("--dy", `${(Math.random() - 0.5) * 5}rem`)
            firefly.style.setProperty("--drift", `${14 + Math.random() * 12}s`)
            firefly.style.setProperty("--glow", `${2.5 + Math.random() * 3}s`)
            firefly.style.setProperty("--delay", `${-Math.random() * 20}s`)
            this.element.appendChild(firefly)
        }
    }
}
