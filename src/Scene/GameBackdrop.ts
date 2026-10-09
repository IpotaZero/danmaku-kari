import { Silhouette } from "../utils/Silhouette"
import { isSmartPhone } from "../utils/Functions/isSmartPhone"

/**
 * 戦闘画面の、キャンバスの外側(左右の余白)に敷く景色。草むらと枝のシルエットに、日や月の光と、漂うもの(雪・風に飛ぶ花びら・霧・砂・星など)。
 * キャンバスの後ろに置くだけなので、見えるのはキャンバスからはみ出た部分だけになる。
 * 何がどう漂うか・空の色は、場所ごとにCSS(css/scenery.css の scenery-<id>)が決める。ここでは要素を並べるだけ。
 * プレイの邪魔にならないよう、動きはどれもゆっくり・暗めにしてある。
 */
export class GameBackdrop {
    readonly element = document.createElement("div")

    constructor() {
        this.element.className = "game-backdrop"
        // スマホは縦長でキャンバスにほぼ隠れるのに、アニメーションの合成だけは毎フレーム走ってカクつきの元になるので止める
        if (isSmartPhone) this.element.classList.add("smartphone")
        this.element.innerHTML = `
            <div class="backdrop-light"></div>
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
            <div class="backdrop-motes"></div>
        `

        // 漂うもの。位置と周期だけばらつかせ、動き方はCSSに任せる
        const motes = this.element.querySelector(".backdrop-motes")!
        for (let i = 0; i < 28; i++) {
            const mote = document.createElement("div")
            mote.className = "backdrop-mote"
            mote.style.setProperty("--x", `${Math.random() * 100}vw`)
            mote.style.setProperty("--y", `${Math.random() * 100}dvh`)
            mote.style.setProperty("--drift", `${(Math.random() - 0.5) * 12}rem`)
            mote.style.setProperty("--pace", `${0.7 + Math.random() * 0.6}`)
            mote.style.setProperty("--delay", `${-Math.random() * 40}s`)
            motes.appendChild(mote)
        }
    }
}
