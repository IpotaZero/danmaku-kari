/**
 * タイトル画面の背景(陽だまり・草むら・飛び交う虫)。
 * 草も虫もすべて単色のシルエット(fill="currentColor")で描き、色と動きはCSS(title-meadow.css)に任せる。
 */
export class TitleMeadow {
    readonly element = document.createElement("div")

    // 頭が右(+x)を向くように描いておく
    private static readonly bugs = {
        butterfly: `
            <g transform="rotate(75)">
                <g class="wing">
                    <path d="M0 0 C -3 -12, -13 -11, -10 -3 C -9 -1, -5 0, 0 0 Z" />
                    <path d="M0 0 C 3 -12, 13 -11, 10 -3 C 9 -1, 5 0, 0 0 Z" />
                    <path d="M0 0 C -2 8, -8 10, -7 4 C -6 2, -3 0.5, 0 0 Z" />
                    <path d="M0 0 C 2 8, 8 10, 7 4 C 6 2, 3 0.5, 0 0 Z" />
                </g>
                <ellipse cx="0" cy="0.5" rx="0.9" ry="6" />
                <path d="M0 -5 Q -1.5 -9 -3.5 -11 M0 -5 Q 1.5 -9 3.5 -11" stroke="currentColor" stroke-width="0.5" fill="none" />
            </g>`,
        dragonfly: `
            <g class="wing" opacity="0.55">
                <ellipse cx="4.5" cy="-6.5" rx="1.6" ry="6.5" transform="rotate(12 4.5 -6.5)" />
                <ellipse cx="4.5" cy="6.5" rx="1.6" ry="6.5" transform="rotate(-12 4.5 6.5)" />
                <ellipse cx="2" cy="-6" rx="1.8" ry="6" transform="rotate(-10 2 -6)" />
                <ellipse cx="2" cy="6" rx="1.8" ry="6" transform="rotate(10 2 6)" />
            </g>
            <circle cx="9" cy="0" r="1.8" />
            <ellipse cx="5.5" cy="0" rx="2.6" ry="1.5" />
            <path d="M3.5 -0.7 L -13 -0.25 L -13 0.25 L 3.5 0.7 Z" />`,
        bee: `
            <ellipse class="wing" cx="-0.5" cy="-5.5" rx="3" ry="5" opacity="0.45" />
            <ellipse cx="-1" cy="1" rx="6.5" ry="4.5" />
            <circle cx="6" cy="0" r="2.8" />
            <path d="M-7 1 L -10 1.6 L -7 2.6 Z" />
            <path d="M7 -2 Q 9 -6 11 -6.5" stroke="currentColor" stroke-width="0.5" fill="none" />`,
        ladybug: `
            <g class="wing" opacity="0.45">
                <ellipse cx="-3" cy="-8" rx="2" ry="6" transform="rotate(-35 -3 -8)" />
                <ellipse cx="-3" cy="8" rx="2" ry="6" transform="rotate(35 -3 8)" />
            </g>
            <circle cx="-1" cy="0" r="6.5" />
            <path d="M4.5 -3 A 3.2 3.2 0 0 1 4.5 3 Z" />
            <circle cx="6.5" cy="0" r="2.3" />`,
    }

    constructor() {
        this.element.className = "title-meadow"
        this.element.innerHTML = `
            <div class="meadow-sun"></div>
            <div class="meadow-bugs meadow-bugs-far"></div>
            <svg class="meadow-grass meadow-grass-back" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
                ${TitleMeadow.grass(140, 70, 0)}
            </svg>
            <svg class="meadow-grass meadow-grass-front" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice">
                ${TitleMeadow.grass(110, 120, 9)}
            </svg>
            <div class="meadow-bugs meadow-bugs-near"></div>
        `

        const far = this.element.querySelector(".meadow-bugs-far")!
        const near = this.element.querySelector(".meadow-bugs-near")!
        const kinds = ["butterfly", "dragonfly", "bee", "ladybug", "butterfly", "dragonfly", "bee", "butterfly"] as const
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
                    <svg viewBox="-14 -14 28 28" fill="currentColor">${TitleMeadow.bugs[kind]}</svg>
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

    /** 草の葉・穂・小花をまとめた1枚のシルエットを返す */
    private static grass(count: number, height: number, flowers: number): string {
        const base = 200
        let blades = ""
        for (let i = 0; i < count; i++) {
            const x = (i + Math.random()) * (1600 / count)
            const h = height * (0.4 + Math.random() * 0.8)
            const lean = (Math.random() - 0.5) * h * 0.7
            const w = 3 + Math.random() * 3
            blades += `M${x - w} ${base} Q${x - w + lean * 0.3} ${base - h * 0.6} ${x + lean} ${base - h} Q${x + w + lean * 0.3} ${base - h * 0.6} ${x + w} ${base} Z `
        }

        let heads = ""
        for (let i = 0; i < flowers; i++) {
            const x = (i + 0.2 + Math.random() * 0.6) * (1600 / flowers)
            const top = base - height * (1 + Math.random() * 0.5)
            const lean = (Math.random() - 0.5) * 30
            heads += `<path d="M${x} ${base} Q${x + lean * 0.2} ${(base + top) / 2} ${x + lean} ${top}" stroke="currentColor" stroke-width="2" fill="none" />`
            if (i % 2 === 0) {
                // 穂(細長い楕円を傾けて重ねる)
                heads += `<ellipse cx="${x + lean}" cy="${top - 10}" rx="3.5" ry="13" transform="rotate(${lean * 0.6} ${x + lean} ${top})" />`
            } else {
                // 野の小花(小さな丸を放射状に並べる)
                for (let k = 0; k < 7; k++) {
                    const a = (k / 7) * Math.PI * 2
                    heads += `<circle cx="${x + lean + Math.cos(a) * 7}" cy="${top + Math.sin(a) * 7}" r="3.6" />`
                }
            }
        }

        return `<path d="${blades}" />${heads}`
    }
}
