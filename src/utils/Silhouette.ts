import { SvgFile } from "./SvgFile"

/**
 * 草・枝・虫など、自然物の単色シルエット(SVGの中身)を作る。
 * すべてfill="currentColor"前提で描くので、色は使う側のCSSで決める。
 */
export class Silhouette {
    // 頭が右(+x)を向くように、(0,0)を体の中心として描いてある(assets/image/bug/、viewBox="-14 -14 28 28")
    static readonly bugs = {
        butterfly: new SvgFile("assets/image/bug/butterfly.svg"),
        dragonfly: new SvgFile("assets/image/bug/dragonfly.svg"),
        bee: new SvgFile("assets/image/bug/bee.svg"),
        ladybug: new SvgFile("assets/image/bug/ladybug.svg"),
    }

    /** 草の葉・穂・小花をまとめた1枚(viewBox="0 0 1600 200"想定、下端が地面) */
    static grass(count: number, height: number, flowers: number): string {
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

    /** 左上の角(0,0)から右下へ垂れる、葉の付いた枝(viewBox="0 0 400 260"想定) */
    static branch(leaves: number): string {
        // 枝は二次ベジェ曲線。はじめは横へ伸び、先へ行くほど垂れ下がる
        const start = { x: -10, y: 10 }
        const control = { x: 220, y: 0 }
        const end = { x: 380, y: 170 }
        const at = (t: number) => ({
            x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
            y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
        })

        let shapes = `<path d="M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none" />`
        for (let i = 0; i < leaves; i++) {
            const t = 0.15 + (i / leaves) * 0.85
            const p = at(t)
            // 葉は枝から下向きに垂らし、左右交互に少し振る
            const angle = (i % 2 === 0 ? 1 : -1) * (20 + Math.random() * 35)
            const size = 0.8 + Math.random() * 0.6
            shapes += `<path d="M0 0 Q 9 12 0 34 Q -9 12 0 0 Z" transform="translate(${p.x} ${p.y}) rotate(${angle}) scale(${size})" />`
        }
        return shapes
    }
}
