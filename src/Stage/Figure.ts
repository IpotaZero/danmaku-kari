// 立ち絵。同じidの立ち絵は同じ位置に出て、表情(src)だけが差し替わる。
// offsetPercentは画面幅に対する左右のずれ(負で左、正で右。中央基準)。主人公は左、相手は右に立つ
export class Figure {
    private constructor(
        readonly id: string,
        readonly src: string,
        readonly offsetPercent: number,
    ) {}

    static readonly hachinoko = new Figure("hachinoko", "assets/figure/Hachinoko.webp", -30)
    static readonly hachinokoSmile = new Figure("hachinoko", "assets/figure/Hachinoko-smile.webp", -30)

    static readonly yukimushi = new Figure("yukimushi", "assets/figure/Yukimushi.webp", 30)
    static readonly yukimushiDefeat = new Figure("yukimushi", "assets/figure/Yukimushi-defeat.webp", 30)
}
