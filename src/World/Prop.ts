import { T } from "../T"
import { Silhouette } from "../utils/Silhouette"

// 小物の絵を組み立てるための、SVGのパスの部品
namespace Shape {
    const f = (n: number) => n.toFixed(2)

    export function line(x1: number, y1: number, x2: number, y2: number): string {
        return `M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`
    }

    // 中心(cx, cy)・半径 r の、頂点が上下にある六角形
    export function hexagon(cx: number, cy: number, r: number): string {
        const points = [0, 1, 2, 3, 4, 5].map((k) => [
            cx + r * Math.cos(T / 12 + (T * k) / 6),
            cy + r * Math.sin(T / 12 + (T * k) / 6),
        ])
        return `M${points.map(([x, y]) => `${f(x!)} ${f(y!)}`).join(" L")} Z`
    }

    // 原点を中心とした正 n 角形。tilt だけ回す
    export function polygon(n: number, r: number, tilt: number): string {
        const points = Array.from({ length: n }, (_, k) => [
            r * Math.cos(tilt + (T * k) / n),
            r * Math.sin(tilt + (T * k) / n),
        ])
        return `M${points.map(([x, y]) => `${f(x!)} ${f(y!)}`).join(" L")} Z`
    }

    // 原点を中心とした n 本の角の星。outer は角の先、inner はくぼみまでの距離
    export function star(n: number, outer: number, inner: number, tilt: number): string {
        const points = Array.from({ length: n * 2 }, (_, k) => {
            const r = k % 2 === 0 ? outer : inner
            const a = tilt + (T * k) / (n * 2)
            return [r * Math.cos(a), r * Math.sin(a)]
        })
        return `M${points.map(([x, y]) => `${f(x!)} ${f(y!)}`).join(" L")} Z`
    }

    // (x, y) を中心に、右を向いた蟻を一匹
    export function ant(x: number, y: number): string {
        return (
            `<circle class="solid" cx="${x + 2.6}" cy="${y}" r="0.9" />` +
            `<ellipse class="solid" cx="${x + 0.6}" cy="${y}" rx="1.1" ry="0.7" />` +
            `<ellipse class="solid" cx="${x - 1.8}" cy="${y}" rx="1.5" ry="1.1" />` +
            `<path d="M${x} ${y} L${x - 1} ${y - 2} M${x} ${y} L${x - 1} ${y + 2} M${x + 0.6} ${y} L${x + 0.6} ${y - 2.2} M${x + 0.6} ${y} L${x + 0.6} ${y + 2.2} M${x + 1.2} ${y} L${x + 2} ${y - 2} M${x + 1.2} ${y} L${x + 2} ${y + 2}" />`
        )
    }
}

// 地図の塊(同じ場所のノードのまとまり)のまわりに置く小物。文字の代わりに、その場所がどんな所かを感じさせる。
// 絵はSVGの中身で、viewBox="-12 -12 24 24"。線は currentColor で描き、class="solid" を付けた形だけ塗りつぶす
export class Prop {
    private constructor(
        readonly svg: string,
        // 地図の上での大きさ(px)
        readonly size: number,
        // 色。地図で使う4色のうちの3色(css/map.css の tone-*)
        readonly tone: "paper" | "sage" | "gold",
        // 動き方(css/map.css の motion-*)。still: 動かない / bob: ふわふわ浮き沈み / sway: 根元を軸に揺れる /
        // hang: 上端を軸に揺れる / twinkle: 瞬く / turn: ゆっくり回る
        readonly motion: "still" | "bob" | "sway" | "hang" | "twinkle" | "turn",
        // 向きを自由に回して置いてよいか(雪の結晶・落ち葉など)。false なら少し傾けるだけにする
        readonly spin: boolean,
    ) {}

    // ---------------------------------------------------------------- 巣
    static readonly comb = new Prop(
        [0, 1, 2, 3, 4, 5, -1]
            .map((k) =>
                k < 0
                    ? Shape.hexagon(0, 0, 3.6)
                    : Shape.hexagon(6.2 * Math.cos((T * k) / 6), 6.2 * Math.sin((T * k) / 6), 3.6),
            )
            .map((d) => `<path d="${d}" />`)
            .join(""),
        48,
        "gold",
        "still",
        false,
    )

    static readonly honey = new Prop(
        `<path d="M0 -9 C4 -3 6.5 1 6.5 3.5 A6.5 6.5 0 0 1 -6.5 3.5 C-6.5 1 -4 -3 0 -9 Z" /><path d="M-3 3 Q-3 6 0 7" />`,
        30,
        "gold",
        "twinkle",
        false,
    )

    static readonly bee = new Prop(
        `<g class="solid" transform="scale(0.85)">${Silhouette.bugs.bee}</g>`,
        34,
        "gold",
        "bob",
        false,
    )

    // ---------------------------------------------------------------- 冬
    static readonly snowflake = new Prop(
        `<path d="${[0, 1, 2, 3, 4, 5]
            .map((k) => {
                const a = (T * k) / 6
                const arm = Shape.line(0, 0, 10 * Math.cos(a), 10 * Math.sin(a))
                const twigs = [5, 7.5].flatMap((at) =>
                    [-1, 1].map((side) =>
                        Shape.line(
                            at * Math.cos(a),
                            at * Math.sin(a),
                            at * Math.cos(a) + 2.6 * Math.cos(a + (side * T) / 6),
                            at * Math.sin(a) + 2.6 * Math.sin(a + (side * T) / 6),
                        ),
                    ),
                )
                return [arm, ...twigs].join(" ")
            })
            .join(" ")}" />`,
        38,
        "paper",
        "turn",
        true,
    )

    static readonly yukimushi = new Prop(
        `<ellipse class="solid" cx="0" cy="2" rx="1.6" ry="2.6" />` +
            // 綿のような白い毛
            `<path d="${[20, 50, 80, 110, 140, 170]
                .map((deg) => {
                    const a = (deg * T) / 360
                    return Shape.line(3 * Math.cos(a), 3 + 3 * Math.sin(a), 5.5 * Math.cos(a), 3 + 5.5 * Math.sin(a))
                })
                .join(" ")}" />` +
            `<path d="M-0.5 -0.5 Q-7 -5 -3 -8.5 M0.5 -0.5 Q7 -5 3 -8.5 M-0.6 -0.6 L-2 -3.5 M0.6 -0.6 L2 -3.5" />`,
        30,
        "paper",
        "bob",
        false,
    )

    static readonly icicles = new Prop(
        `<path d="M-11 -8 Q0 -10.5 11 -7" /><path d="M-7 -8.4 L-5.8 1 L-4.6 -8.8 M-1.6 -9.2 L-0.2 5 L1.2 -9.2 M4 -8.8 L5 -1 L6.2 -8.4" />`,
        44,
        "paper",
        "still",
        false,
    )

    static readonly frostedGrass = new Prop(
        `<path d="M-6 11 Q-5 0 -8 -8 M-1 11 Q0 -2 2 -10 M4 11 Q5 2 9 -5" /><path d="M-7 -4 L-9 -5 M1.4 -6 L3.5 -7 M7 -1.5 L9 -1" />`,
        42,
        "sage",
        "sway",
        false,
    )

    // ---------------------------------------------------------------- 早春
    static readonly swirl = new Prop(
        `<path d="M-11 1 C-5 1 1 -2.5 5 -2.5 A3.8 3.8 0 1 0 1.4 -6.4 M-8 6 C-2 6 4 4.5 10 4.5" />`,
        46,
        "paper",
        "still",
        false,
    )

    static readonly blownLeaf = new Prop(
        `<path d="M-8 4 Q-6 -6 8 -4 Q4 6 -8 4 Z" /><path d="M-8 4 Q0 0 8 -4 M-2 1.6 L-1 -2 M2 0 L3.4 -3" />`,
        32,
        "sage",
        "bob",
        true,
    )

    static readonly dandelionSeed = new Prop(
        `<path d="M0 9 L0 -2" /><path d="${[-150, -130, -110, -90, -70, -50, -30]
            .map((deg) => Shape.line(0, -2, 7 * Math.cos((deg * T) / 360), -2 + 7 * Math.sin((deg * T) / 360)))
            .join(" ")}" /><ellipse class="solid" cx="0" cy="10" rx="0.8" ry="1.6" />`,
        30,
        "paper",
        "bob",
        true,
    )

    static readonly bentGrass = new Prop(
        `<path d="M-7 11 Q-7 1 1 -6 M-2 11 Q-1 3 8 -2 M3 11 Q4 5 11 2" />`,
        44,
        "sage",
        "sway",
        false,
    )

    // ---------------------------------------------------------------- 春の朝
    static readonly cobweb = new Prop(
        `<path d="${[0, 1, 2, 3, 4, 5, 6, 7]
            .map((k) => Shape.line(0, 0, 11 * Math.cos((T * k) / 8), 11 * Math.sin((T * k) / 8)))
            .join(" ")}" />` + [3.5, 6.5, 9.5].map((r) => `<path d="${Shape.polygon(8, r, T / 16)}" />`).join(""),
        52,
        "paper",
        "still",
        true,
    )

    static readonly hangingSpider = new Prop(
        `<path d="M0 -12 V1" /><circle class="solid" cx="0" cy="2.6" r="1.8" /><circle class="solid" cx="0" cy="6" r="2.6" />` +
            `<path d="M-1.4 3 L-5 0 L-6.5 1.5 M1.4 3 L5 0 L6.5 1.5 M-1.6 4 L-6 3.5 L-7.5 6 M1.6 4 L6 3.5 L7.5 6 M-1.5 5 L-5 7.5 L-6 10 M1.5 5 L5 7.5 L6 10" />`,
        40,
        "paper",
        "hang",
        false,
    )

    static readonly dew = new Prop(
        `<path d="M-11 -6 Q0 3 11 -5" /><circle cx="-5" cy="1.2" r="1.6" /><circle cx="1" cy="2.4" r="2.2" /><circle cx="6.5" cy="0" r="1.2" />`,
        40,
        "paper",
        "twinkle",
        false,
    )

    // ---------------------------------------------------------------- 梅雨
    static readonly reeds = new Prop(
        `<path d="M-5 11 Q-5 0 -6 -10 M1 11 Q1 2 3 -8 M7 11 Q7 4 9 -3" />` +
            `<rect class="solid" x="-7.1" y="-9" width="2.2" height="5.5" rx="1.1" />` +
            `<rect class="solid" x="1.6" y="-7" width="2.2" height="5" rx="1.1" />`,
        46,
        "sage",
        "sway",
        false,
    )

    static readonly wisp = new Prop(
        `<path d="M-11 -3 Q-8 -6 -5 -3 T1 -3 T7 -3 M-7 3 Q-4 0 -1 3 T5 3 T11 3" />`,
        50,
        "paper",
        "still",
        false,
    )

    static readonly ripple = new Prop(
        `<ellipse rx="10" ry="3" /><ellipse rx="6" ry="1.8" /><ellipse rx="2.5" ry="0.8" />`,
        44,
        "paper",
        "still",
        false,
    )

    static readonly mayfly = new Prop(
        `<path d="M-6 4 Q0 2.5 5 0" /><path d="M-6 4 L-11 2.5 M-6 4 L-11 5.5 M-6 4 L-10.5 8" />` +
            `<path d="M0.5 2 Q-2 -8 3.5 -9.5 Q5 -3 2.8 1" /><circle class="solid" cx="5.6" cy="-0.3" r="1.1" />`,
        36,
        "paper",
        "bob",
        false,
    )

    // ---------------------------------------------------------------- 夏(砂の崖)
    static readonly antlionPit = new Prop(
        `<ellipse rx="11" ry="4" /><ellipse rx="7" ry="2.4" /><ellipse rx="3.4" ry="1.1" /><circle class="solid" r="0.8" />`,
        52,
        "gold",
        "still",
        false,
    )

    static readonly ants = new Prop(
        [-8, 0, 8].map((x, i) => Shape.ant(x, i === 1 ? -1.5 : 0.8)).join(""),
        44,
        "paper",
        "still",
        false,
    )

    static readonly dunes = new Prop(
        `<path d="M-11 6 Q-5 -2 1 6 M-3 6 Q4 -5 11 6 M-11 6 H11 M-3 -7 H5 M-7 -4 H-1" />`,
        48,
        "gold",
        "still",
        false,
    )

    // ---------------------------------------------------------------- 盛夏
    static readonly sun = new Prop(
        `<circle r="4" /><path d="${[0, 1, 2, 3, 4, 5, 6, 7]
            .map((k) => {
                const a = (T * k) / 8
                const c = Math.cos(a)
                const s = Math.sin(a)
                // 陽炎のように、ゆらいだ光の筋
                return `M${6 * c} ${6 * s} Q${8 * c - s} ${8 * s + c} ${10 * c} ${10 * s}`
            })
            .join(" ")}" />`,
        44,
        "gold",
        "twinkle",
        false,
    )

    static readonly stones = new Prop(
        `<rect x="-10.5" y="2" width="9.5" height="6.5" rx="2" /><rect x="0" y="2" width="10.5" height="6.5" rx="2" /><rect x="-6" y="-5.5" width="11" height="6.5" rx="2" />`,
        44,
        "paper",
        "still",
        false,
    )

    // 蝉の抜け殻
    static readonly cicadaShell = new Prop(
        `<path d="M0 -9 C3.5 -9 4.5 -5 4 -1 C3.5 4 2 8 0 10 C-2 8 -3.5 4 -4 -1 C-4.5 -5 -3.5 -9 0 -9 Z" />` +
            `<path d="M-3.6 1 H3.6 M-3 4 H3 M-2 7 H2 M0 -9 V-3" />` +
            `<circle class="solid" cx="-2.5" cy="-7" r="0.9" /><circle class="solid" cx="2.5" cy="-7" r="0.9" />` +
            `<path d="M-4 -3 L-8 -6 M4 -3 L8 -6 M-4 0 L-8 0 M4 0 L8 0 M-3.6 3 L-7 6 M3.6 3 L7 6" />`,
        36,
        "gold",
        "still",
        false,
    )

    static readonly heatWaves = new Prop(
        `<path d="M-5 10 Q-3 6 -5 2 T-5 -6 M0 8 Q2 4 0 0 T0 -8 M5 10 Q7 6 5 2 T5 -6" />`,
        40,
        "gold",
        "sway",
        false,
    )

    // ---------------------------------------------------------------- 夏の午後(古い木)
    static readonly beetle = new Prop(
        `<ellipse class="solid" cx="0" cy="3" rx="5" ry="6.5" /><ellipse class="solid" cx="0" cy="-4.6" rx="3.6" ry="2.6" />` +
            `<path d="M0 -6.5 Q0 -10 -2.5 -11.5 M-1 -9.2 L-3 -9.8" />` +
            `<path d="M-4.5 0 L-8.5 -2 M4.5 0 L8.5 -2 M-4.8 3 L-9 4 M4.8 3 L9 4 M-4 6 L-7.5 9 M4 6 L7.5 9" />`,
        36,
        "paper",
        "still",
        false,
    )

    static readonly acorn = new Prop(
        `<path d="M-5 -2 Q-5 -7 0 -7 Q5 -7 5 -2 Z" /><path d="M-3 -6 L1 -2 M0 -7 L4 -3 M-5 -4 L-3 -2" />` +
            `<path d="M-4 -2 Q-4.5 6 0 9 Q4.5 6 4 -2 M0 -7 V-9.5" />`,
        30,
        "gold",
        "still",
        true,
    )

    static readonly sap = new Prop(
        `<path d="M-6 -11 Q-7 0 -6 11 M-1 -11 Q0 0 -1 11 M5 -11 Q4 0 5 11" /><path class="solid" d="M2 -3 Q4.5 2 2 4 Q-0.5 2 2 -3 Z" />`,
        44,
        "sage",
        "still",
        false,
    )

    // ---------------------------------------------------------------- 夏の夜
    static readonly sparkle = new Prop(
        `<path d="M0 -9 Q1 -1 9 0 Q1 1 0 9 Q-1 1 -9 0 Q-1 -1 0 -9 Z" />`,
        26,
        "gold",
        "twinkle",
        false,
    )

    static readonly shootingStar = new Prop(
        `<path d="M7 -7 Q7.5 -4.5 10 -4 Q7.5 -3.5 7 -1 Q6.5 -3.5 4 -4 Q6.5 -4.5 7 -7 Z" /><path d="M4.5 -2 L-10 10 M3 -4.5 L-6 2.5 M6.5 -0.5 L1 6" />`,
        48,
        "paper",
        "still",
        false,
    )

    static readonly firefly = new Prop(
        `<circle cx="0" cy="3" r="5" stroke-dasharray="1 2" /><ellipse class="solid" cx="0" cy="1" rx="1.6" ry="3" />` +
            `<path d="M-0.6 -1.5 Q-5 -6 -2 -8 M0.6 -1.5 Q5 -6 2 -8" />`,
        30,
        "gold",
        "twinkle",
        false,
    )

    static readonly pebbles = new Prop(
        `<ellipse cx="-5" cy="2" rx="5" ry="3.2" /><ellipse cx="4.5" cy="4" rx="4" ry="2.6" /><ellipse cx="1" cy="-3.6" rx="3.6" ry="2.4" />`,
        40,
        "paper",
        "still",
        false,
    )

    // ---------------------------------------------------------------- 秋の夜
    static readonly moon = new Prop(
        `<path d="M3 -10 A10 10 0 1 0 10 5 A8 8 0 1 1 3 -10 Z" />`,
        44,
        "gold",
        "still",
        false,
    )

    static readonly susuki = new Prop(
        `<path d="M-3 11 Q-2 0 4 -8" /><path d="M4 -8 Q7 -6 8 -2 M3 -6 Q6 -4 6.5 0 M2 -4 Q4.5 -2 4.5 2 M4 -8 Q6.5 -9.5 9.5 -8.5 M3.2 -6.6 Q6.5 -7 9 -5" />`,
        46,
        "paper",
        "sway",
        false,
    )

    static readonly suzumushi = new Prop(
        `<ellipse class="solid" cx="0" cy="1" rx="3.2" ry="5.5" /><circle class="solid" cx="0" cy="-5.6" r="1.8" />` +
            `<path d="M-0.8 -7 Q-4 -12 -10 -11 M0.8 -7 Q4 -12 10 -11 M-2.5 3 L-7 -1 L-8 7 M2.5 3 L7 -1 L8 7 M-1 6.5 L-2.5 10 M1 6.5 L2.5 10" />`,
        34,
        "paper",
        "still",
        false,
    )

    // 月見団子
    static readonly dango = new Prop(
        [
            [-5, 6],
            [0, 6],
            [5, 6],
            [-2.5, 1.6],
            [2.5, 1.6],
            [0, -2.8],
        ]
            .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" />`)
            .join("") + `<path d="M-10 9.4 H10 M-7 9.4 L-6 11.5 H6 L7 9.4" />`,
        36,
        "paper",
        "still",
        false,
    )

    // ---------------------------------------------------------------- 晩秋
    static readonly hornetNest = new Prop(
        `<path d="M0 -10 C7 -10 10 -4 10 1 C10 7 5 10 0 10 C-5 10 -10 7 -10 1 C-10 -4 -7 -10 0 -10 Z" />` +
            `<path d="M-9 -4 Q-4 -6 0 -4 T9 -4 M-10 1 Q-5 -1 0 1 T10 1 M-8.5 6 Q-4 4 0 6 T8.5 6 M-6 -12 H6 M0 -12 V-10" />` +
            `<ellipse class="solid" cx="0" cy="8.5" rx="1.6" ry="1" />`,
        54,
        "gold",
        "still",
        false,
    )

    static readonly hornet = new Prop(
        `<circle class="solid" cx="7" cy="0" r="2.2" /><ellipse class="solid" cx="2.8" cy="0" rx="2.6" ry="2.2" />` +
            `<ellipse cx="-4" cy="0" rx="5" ry="3.2" /><path class="solid" d="M-2 -3 H-0.6 V3 H-2 Z M-5 -3.1 H-3.6 V3.1 H-5 Z M-7.8 -2.4 H-6.6 V2.4 H-7.8 Z" />` +
            `<path d="M3 -2 Q0 -9 -6 -7 Q-2 -4 2 -2 M9 -1 L10.5 -2 M9 1 L10.5 2" />`,
        38,
        "gold",
        "bob",
        false,
    )

    static readonly mapleLeaf = new Prop(
        `<path d="${Shape.star(5, 10, 4.2, -T / 4)}" /><path d="M0 0 L0 11 M0 0 L0 -9 M0 0 L9 -3 M0 0 L-9 -3 M0 0 L5.5 7.5 M0 0 L-5.5 7.5" />`,
        34,
        "gold",
        "bob",
        true,
    )
}
