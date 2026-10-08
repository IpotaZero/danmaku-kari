import { Silhouette } from "../utils/Silhouette"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"

/**
 * 戦闘画面の、キャンバスの外側(左右の余白)に敷く晩秋の夜の草むら。雪虫が漂っている。
 * キャンバスの後ろに置くだけなので、見えるのはキャンバスからはみ出た部分だけになる。
 * プレイの邪魔にならないよう、動きはどれもゆっくり・暗めにしてある。色と動きはCSS(game-backdrop.css)に任せる。
 */
export class GameBackdrop {
    readonly element = document.createElement("div")

    constructor() {
        this.element.className = "game-backdrop"
        // スマホは縦長でキャンバスにほぼ隠れるのに、アニメーションの合成だけは毎フレーム走ってカクつきの元になるので止める
        if (isSmartPhone) this.element.classList.add("smartphone")
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
            const yukimushi = document.createElement("div")
            yukimushi.className = "backdrop-yukimushi"
            yukimushi.style.setProperty("--x", `${Math.random() * 100}%`)
            yukimushi.style.setProperty("--drift", `${(Math.random() - 0.5) * 12}rem`)
            yukimushi.style.setProperty("--fall", `${22 + Math.random() * 18}s`)
            yukimushi.style.setProperty("--delay", `${-Math.random() * 40}s`)
            this.element.appendChild(yukimushi)
        }
    }
}
