import { SvgFile } from "../utils/SvgFile"

// 地図の塊(同じ場所のノードのまとまり)のまわりに置く小物。文字の代わりに、その場所がどんな所かを感じさせる。
// 絵は assets/image/prop/ のSVGファイルで、viewBox="-12 -12 24 24"。線は currentColor で描き、class="solid" を付けた形だけ塗りつぶす
export class Prop {
    private constructor(
        readonly svg: SvgFile,
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
    static readonly comb = new Prop(new SvgFile("assets/image/prop/comb.svg"), 48, "gold", "still", false)
    static readonly honey = new Prop(new SvgFile("assets/image/prop/honey.svg"), 30, "gold", "twinkle", false)
    static readonly bee = new Prop(new SvgFile("assets/image/prop/bee.svg"), 34, "gold", "bob", false)

    // ---------------------------------------------------------------- 冬
    static readonly snowflake = new Prop(new SvgFile("assets/image/prop/snowflake.svg"), 38, "paper", "turn", true)
    static readonly yukimushi = new Prop(new SvgFile("assets/image/prop/yukimushi.svg"), 30, "paper", "bob", false)
    static readonly icicles = new Prop(new SvgFile("assets/image/prop/icicles.svg"), 44, "paper", "still", false)
    static readonly frostedGrass = new Prop(new SvgFile("assets/image/prop/frosted-grass.svg"), 42, "sage", "sway", false)

    // ---------------------------------------------------------------- 早春
    static readonly swirl = new Prop(new SvgFile("assets/image/prop/swirl.svg"), 46, "paper", "still", false)
    static readonly blownLeaf = new Prop(new SvgFile("assets/image/prop/blown-leaf.svg"), 32, "sage", "bob", true)
    static readonly dandelionSeed = new Prop(new SvgFile("assets/image/prop/dandelion-seed.svg"), 30, "paper", "bob", true)
    static readonly bentGrass = new Prop(new SvgFile("assets/image/prop/bent-grass.svg"), 44, "sage", "sway", false)

    // ---------------------------------------------------------------- 春の朝
    static readonly cobweb = new Prop(new SvgFile("assets/image/prop/cobweb.svg"), 52, "paper", "still", true)
    static readonly hangingSpider = new Prop(new SvgFile("assets/image/prop/hanging-spider.svg"), 40, "paper", "hang", false)
    static readonly dew = new Prop(new SvgFile("assets/image/prop/dew.svg"), 40, "paper", "twinkle", false)

    // ---------------------------------------------------------------- 梅雨
    static readonly reeds = new Prop(new SvgFile("assets/image/prop/reeds.svg"), 46, "sage", "sway", false)
    static readonly wisp = new Prop(new SvgFile("assets/image/prop/wisp.svg"), 50, "paper", "still", false)
    static readonly ripple = new Prop(new SvgFile("assets/image/prop/ripple.svg"), 44, "paper", "still", false)
    static readonly mayfly = new Prop(new SvgFile("assets/image/prop/mayfly.svg"), 36, "paper", "bob", false)

    // ---------------------------------------------------------------- 夏(砂の崖)
    static readonly antlionPit = new Prop(new SvgFile("assets/image/prop/antlion-pit.svg"), 52, "gold", "still", false)
    static readonly ants = new Prop(new SvgFile("assets/image/prop/ants.svg"), 44, "paper", "still", false)
    static readonly dunes = new Prop(new SvgFile("assets/image/prop/dunes.svg"), 48, "gold", "still", false)

    // ---------------------------------------------------------------- 盛夏
    static readonly sun = new Prop(new SvgFile("assets/image/prop/sun.svg"), 44, "gold", "twinkle", false)
    static readonly stones = new Prop(new SvgFile("assets/image/prop/stones.svg"), 44, "paper", "still", false)
    // 蝉の抜け殻
    static readonly cicadaShell = new Prop(new SvgFile("assets/image/prop/cicada-shell.svg"), 36, "gold", "still", false)
    static readonly heatWaves = new Prop(new SvgFile("assets/image/prop/heat-waves.svg"), 40, "gold", "sway", false)

    // ---------------------------------------------------------------- 夏の午後(古い木)
    static readonly beetle = new Prop(new SvgFile("assets/image/prop/beetle.svg"), 36, "paper", "still", false)
    static readonly acorn = new Prop(new SvgFile("assets/image/prop/acorn.svg"), 30, "gold", "still", true)
    static readonly sap = new Prop(new SvgFile("assets/image/prop/sap.svg"), 44, "sage", "still", false)

    // ---------------------------------------------------------------- 夏の夜
    static readonly sparkle = new Prop(new SvgFile("assets/image/prop/sparkle.svg"), 26, "gold", "twinkle", false)
    static readonly shootingStar = new Prop(new SvgFile("assets/image/prop/shooting-star.svg"), 48, "paper", "still", false)
    static readonly firefly = new Prop(new SvgFile("assets/image/prop/firefly.svg"), 30, "gold", "twinkle", false)
    static readonly pebbles = new Prop(new SvgFile("assets/image/prop/pebbles.svg"), 40, "paper", "still", false)

    // ---------------------------------------------------------------- 秋の夜
    static readonly moon = new Prop(new SvgFile("assets/image/prop/moon.svg"), 44, "gold", "still", false)
    static readonly susuki = new Prop(new SvgFile("assets/image/prop/susuki.svg"), 46, "paper", "sway", false)
    static readonly suzumushi = new Prop(new SvgFile("assets/image/prop/suzumushi.svg"), 34, "paper", "still", false)
    // 月見団子
    static readonly dango = new Prop(new SvgFile("assets/image/prop/dango.svg"), 36, "paper", "still", false)

    // ---------------------------------------------------------------- 晩秋
    static readonly hornetNest = new Prop(new SvgFile("assets/image/prop/hornet-nest.svg"), 54, "gold", "still", false)
    static readonly hornet = new Prop(new SvgFile("assets/image/prop/hornet.svg"), 38, "gold", "bob", false)
    static readonly mapleLeaf = new Prop(new SvgFile("assets/image/prop/maple-leaf.svg"), 34, "gold", "bob", true)
}
