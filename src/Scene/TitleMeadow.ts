import { Silhouette } from "../utils/Silhouette"

/**
 * タイトル画面の背景(陽だまり・草むら・飛び交う虫)。
 * 草も虫もすべて単色のシルエット(fill="currentColor")で描き、色と動きはCSS(title-meadow.css)に任せる。
 */
export class TitleMeadow {
    readonly element = document.createElement("div")

    constructor() {
        this.element.className = "title-meadow"
        this.element.innerHTML = `
            <div class="meadow-sun"></div>
            <div class="meadow-bugs meadow-bugs-far"></div>
            <svg class="meadow-grass meadow-grass-back" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
                ${Silhouette.grass(140, 70, 0)}
            </svg>
            <svg class="meadow-grass meadow-grass-front" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
                ${Silhouette.grass(110, 120, 9)}
            </svg>
            <div class="meadow-bugs meadow-bugs-near"></div>
        `

        const far = this.element.querySelector(".meadow-bugs-far")!
        const near = this.element.querySelector(".meadow-bugs-near")!
        const kinds = [
            "butterfly",
            "dragonfly",
            "bee",
            "ladybug",
            "butterfly",
            "dragonfly",
            "bee",
            "butterfly",
        ] as const
        kinds.forEach((kind, i) => {
            const isNear = i % 2 === 0
            const bug = document.createElement("div")
            bug.className = `meadow-bug meadow-bug-${kind}${i % 3 === 1 ? " reverse" : ""}`
            bug.style.setProperty("--y", `${10 + Math.random() * 55}%`)
            bug.style.setProperty("--duration", `${(isNear ? 22 : 38) + Math.random() * 14}s`)
            bug.style.setProperty("--delay", `${-i * 5.7 - Math.random() * 4}s`)
            bug.style.setProperty("--bob", `${1.2 + Math.random() * 1.4}s`)
            bug.style.setProperty("--size", `${isNear ? 2.4 + Math.random() * 1.2 : 1.1 + Math.random() * 0.6}rem`)
            bug.innerHTML = `
                <div class="meadow-bug-body">
                    <svg viewBox="-14 -14 28 28" fill="currentColor">${Silhouette.bugs[kind]}</svg>
                </div>`
            ;(isNear ? near : far).appendChild(bug)
        })

        for (let i = 0; i < 14; i++) {
            const pollen = document.createElement("div")
            pollen.className = "meadow-pollen"
            pollen.style.setProperty("--x", `${Math.random() * 100}%`)
            pollen.style.setProperty("--duration", `${10 + Math.random() * 10}s`)
            pollen.style.setProperty("--delay", `${-Math.random() * 20}s`)
            pollen.style.setProperty("--drift", `${(Math.random() - 0.5) * 6}rem`)
            this.element.appendChild(pollen)
        }
    }
}
