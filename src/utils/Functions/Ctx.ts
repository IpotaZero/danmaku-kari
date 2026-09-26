const gcd = (x: number, y: number): number => (x % y ? gcd(y, x % y) : y)

export class Ctx {
    static arc(
        ctx: CanvasRenderingContext2D,
        [x, y]: [number, number],
        r: number,
        color: string,
        {
            lineWidth = 0,
            start = 0,
            end = 2 * Math.PI,
        }: {
            lineWidth?: number
            start?: number
            end?: number
        } = {},
    ) {
        if (r <= 0) return

        ctx.beginPath()
        ctx.arc(x, y, r, start, end)

        if (lineWidth > 0) {
            ctx.strokeStyle = color
            ctx.lineWidth = lineWidth
            ctx.stroke()
        } else {
            ctx.fillStyle = color
            ctx.fill()
        }
    }

    static polygon(
        ctx: CanvasRenderingContext2D,
        vertices: number,
        density: number,
        [x, y]: [number, number],
        r: number,
        color: string,
        {
            theta = 0,
            lineWidth = 2,
        }: {
            theta?: number
            lineWidth?: number
        } = {},
    ) {
        if (r <= 0) return

        const g = gcd(vertices, density)
        const reducedVertices = vertices / g
        const reducedDensity = density / g

        const angle = (2 * Math.PI * reducedDensity) / reducedVertices
        const baseAngle = theta

        ctx.beginPath()

        const sinCache = Array(reducedVertices + 1)
        const cosCache = Array(reducedVertices + 1)
        for (let i = 0; i <= reducedVertices; i++) {
            const curAngle = baseAngle + angle * i
            sinCache[i] = Math.sin(curAngle)
            cosCache[i] = Math.cos(curAngle)
        }

        for (let h = 0; h < g; h++) {
            const groupAngle = (2 * Math.PI * h) / g / reducedVertices
            const groupSin = Math.sin(groupAngle)
            const groupCos = Math.cos(groupAngle)

            let firstX =
                x + r * (cosCache[0] * groupCos - sinCache[0] * groupSin)
            let firstY =
                y + r * (sinCache[0] * groupCos + cosCache[0] * groupSin)

            ctx.moveTo(firstX, firstY)

            for (let i = 1; i <= reducedVertices; i++) {
                const pointX =
                    x + r * (cosCache[i] * groupCos - sinCache[i] * groupSin)
                const pointY =
                    y + r * (sinCache[i] * groupCos + cosCache[i] * groupSin)
                ctx.lineTo(pointX, pointY)
            }
        }

        if (lineWidth > 0) {
            ctx.strokeStyle = color
            ctx.lineWidth = lineWidth
            ctx.stroke()
        } else {
            ctx.fillStyle = color
            ctx.fill()
        }
    }

    static rect(
        ctx: CanvasRenderingContext2D,
        [x, y]: [number, number],
        [w, h]: [number, number],
        color: string,
        {
            lineWidth = 0,
        }: {
            lineWidth?: number
        } = {},
    ) {
        ctx.beginPath()

        if (lineWidth != 0) {
            ctx.strokeStyle = color
            ctx.lineWidth = lineWidth
            ctx.strokeRect(x, y, w, h)
        } else {
            ctx.fillStyle = color
            ctx.fillRect(x, y, w, h)
        }
    }

    static calligraphicStroke(
        ctx: CanvasRenderingContext2D,
        [x1, y1]: [number, number],
        [x2, y2]: [number, number],
        color: string,
        maxLineWidth: number,
        divisions: number,
    ) {
        for (let i = 0; i < divisions; i++) {
            const progress = i / divisions
            const x = x1 + (x2 - x1) * progress
            const y = y1 + (y2 - y1) * progress
            const r = 1 + maxLineWidth * Math.sin(Math.PI * progress)
            this.arc(ctx, [x, y], r, color)
        }
    }

    static text(
        ctx: CanvasRenderingContext2D,
        [x, y]: [number, number],
        color: string,
        text: string,
        {
            align = "center",
            baseline = "middle",
            fontFamily,
            fontSize,
        }: {
            align?: CanvasTextAlign
            baseline?: CanvasTextBaseline
            fontFamily?: string
            fontSize?: number
        } = {},
    ) {
        if (fontFamily && fontSize) {
            ctx.font = `${fontSize}px ${fontFamily}`
        }

        ctx.textAlign = align
        ctx.textBaseline = baseline
        ctx.fillStyle = color
        ctx.fillText(text, x, y)
    }
}
