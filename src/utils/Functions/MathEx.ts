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
}
