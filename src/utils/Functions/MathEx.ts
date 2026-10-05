import { Vec, vec } from "@ipota/vec"

export class MathEx {
    static sum(values: readonly number[]) {
        return values.reduce((a, b) => a + b, 0)
    }

    static sorted012(values: readonly number[]) {
        return values.toSorted((a, b) => a - b)
    }

    static sorted210(values: readonly number[]) {
        return values.toSorted((a, b) => b - a)
    }

    // center を通る angle 向きの線を挟んで、p を鏡写しにした点
    static reflect(p: Vec, center: Vec, angle: number): Vec {
        const v = p.sub(center)
        const cos = Math.cos(2 * angle)
        const sin = Math.sin(2 * angle)
        return center.add(vec(v.x * cos + v.y * sin, v.x * sin - v.y * cos))
    }
}
