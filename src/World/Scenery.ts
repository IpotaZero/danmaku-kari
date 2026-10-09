import { Bark, Frost, Grass, Ground, Gust, Honeycomb, Mist, Ripple, Stones, Stream, Web } from "./Ground"
import { Prop } from "./Prop"

// 草むらの一年のうちの、ある場所の景色。文字を使わずに、いまどこにいるのかを感じさせる。
// 景色は三つの所に同じ顔で現れる。
//   戦闘画面のキャンバスの中: ground(ごく薄く流れる地面の模様)
//   キャンバスの外: CSSの scenery-<id> (空の色、日や月の光、漂うもの。css/scenery.css)
//   地図: motif(ノードに描く小さな絵柄)と props(塊のまわりに置く小物)
// どの景色になるかはステージのフォルダで決まる(MapNode.scenery)
export class Scenery {
    private constructor(
        readonly id: string,
        readonly ground: Ground,
        // 地図のノードに描く絵柄(SVGの中身、viewBox="-12 -12 24 24"、線は currentColor)
        readonly motif: string,
        // 地図の塊のまわりに置く小物。塊が小さくて全部は置けないときは、前にあるものから置く
        readonly props: readonly Prop[],
    ) {}

    // 巣。一年の始まりと終わりに帰ってくる所
    static readonly hive = new Scenery(
        "hive",
        new Honeycomb(40, 0.3, "rgba(255, 200, 90, 0.07)"),
        `<path d="M0 -8 L6.9 -4 L6.9 4 L0 8 L-6.9 4 L-6.9 -4 Z" /><path d="M0 -3.5 L3 -1.75 L3 1.75 L0 3.5 L-3 1.75 L-3 -1.75 Z" />`,
        [Prop.comb, Prop.bee, Prop.honey, Prop.bee, Prop.comb, Prop.bee],
    )

    // 冬。霜の降りた野
    static readonly frost = new Scenery(
        "frost",
        new Frost(512, 0.4, "rgba(190, 225, 255, 0.09)"),
        `<path d="M0 -9 V9 M-7.8 -4.5 L7.8 4.5 M-7.8 4.5 L7.8 -4.5 M0 -6 L-2 -8 M0 -6 L2 -8 M0 6 L-2 8 M0 6 L2 8" />`,
        [
            Prop.yukimushi,
            Prop.snowflake,
            Prop.icicles,
            Prop.frostedGrass,
            Prop.snowflake,
            Prop.yukimushi,
            Prop.snowflake,
            Prop.frostedGrass,
        ],
    )

    // 早春。尾根を吹き抜ける風
    static readonly gale = new Scenery(
        "gale",
        new Gust(512, 1.1, "rgba(190, 255, 200, 0.08)"),
        `<path d="M-9 -3 H4 A3 3 0 1 0 1 -6 M-9 2 H7 A3 3 0 1 1 4 5 M-6 7 H0" />`,
        [
            Prop.swirl,
            Prop.blownLeaf,
            Prop.bentGrass,
            Prop.dandelionSeed,
            Prop.blownLeaf,
            Prop.swirl,
            Prop.dandelionSeed,
            Prop.blownLeaf,
        ],
    )

    // 春。朝露の残る、蜘蛛の巣の張られた藪
    static readonly web = new Scenery(
        "web",
        new Web(512, 0.3, "rgba(220, 225, 235, 0.09)"),
        `<path d="M0 -9 V9 M-9 0 H9 M-6.4 -6.4 L6.4 6.4 M-6.4 6.4 L6.4 -6.4" /><path d="M0 -4 L2.8 -2.8 L4 0 L2.8 2.8 L0 4 L-2.8 2.8 L-4 0 L-2.8 -2.8 Z M0 -7.5 L5.3 -5.3 L7.5 0 L5.3 5.3 L0 7.5 L-5.3 5.3 L-7.5 0 L-5.3 -5.3 Z" />`,
        [Prop.cobweb, Prop.hangingSpider, Prop.dew, Prop.cobweb, Prop.dew, Prop.hangingSpider, Prop.dew, Prop.cobweb],
    )

    // 梅雨。霧の立ちこめる沢
    static readonly mist = new Scenery(
        "mist",
        new Mist(512, 0.25, "rgba(180, 200, 220, 0.09)"),
        `<path d="M-9 -5 Q-6 -8 -3 -5 T3 -5 T9 -5 M-9 0 Q-6 -3 -3 0 T3 0 T9 0 M-9 5 Q-6 2 -3 5 T3 5 T9 5" />`,
        [Prop.reeds, Prop.mayfly, Prop.wisp, Prop.ripple, Prop.reeds, Prop.wisp, Prop.mayfly, Prop.ripple],
    )

    // 夏。乾いた砂の崖
    static readonly sand = new Scenery(
        "sand",
        new Ripple(512, 0.5, "rgba(255, 220, 160, 0.07)"),
        `<path d="M-10 6 Q-4 -4 2 6 M-2 6 Q4 -1 10 6 M-10 6 H10" />`,
        [Prop.antlionPit, Prop.ants, Prop.dunes, Prop.ants, Prop.antlionPit, Prop.dunes, Prop.ants, Prop.dunes],
    )

    // 盛夏。陽炎の立つ石垣
    static readonly haze = new Scenery(
        "haze",
        new Stones(512, 0.4, "rgba(255, 170, 110, 0.07)"),
        `<circle r="3.5" /><path d="M0 -9 Q1 -7.5 0 -6 M0 6 Q-1 7.5 0 9 M-9 0 Q-7.5 1 -6 0 M6 0 Q7.5 -1 9 0 M-6.4 -6.4 Q-4.6 -5.6 -4.2 -4.2 M4.2 4.2 Q4.6 5.6 6.4 6.4 M-6.4 6.4 Q-5.6 4.6 -4.2 4.2 M4.2 -4.2 Q5.6 -4.6 6.4 -6.4" />`,
        [
            Prop.sun,
            Prop.stones,
            Prop.cicadaShell,
            Prop.heatWaves,
            Prop.stones,
            Prop.heatWaves,
            Prop.cicadaShell,
            Prop.stones,
        ],
    )

    // 夏。甲虫の集まる古い木
    static readonly iron = new Scenery(
        "iron",
        new Bark(512, 0.35, "rgba(210, 170, 130, 0.07)"),
        `<ellipse cx="0" cy="2" rx="5.5" ry="7" /><path d="M0 -5 V9 M0 -5 Q-1 -9 -4 -10 M-5 -1 L-9 -3 M5 -1 L9 -3 M-5 4 L-9 5 M5 4 L9 5" />`,
        [Prop.beetle, Prop.acorn, Prop.sap, Prop.acorn, Prop.beetle, Prop.sap, Prop.acorn, Prop.acorn],
    )

    // 夏の夜。星の映る河原
    static readonly meteor = new Scenery(
        "meteor",
        new Stream(512, 0.45, "rgba(150, 180, 255, 0.09)"),
        `<path d="M3 -6 L4.2 -2.6 L7.8 -2.6 L4.9 -0.5 L6 3 L3 0.9 L0 3 L1.1 -0.5 L-1.8 -2.6 L1.8 -2.6 Z M-0.5 1.5 L-9 8 M-2 -1 L-8 2" />`,
        [
            Prop.shootingStar,
            Prop.firefly,
            Prop.sparkle,
            Prop.pebbles,
            Prop.sparkle,
            Prop.firefly,
            Prop.sparkle,
            Prop.pebbles,
        ],
    )

    // 秋の夜。月の照らす草むら
    static readonly moon = new Scenery(
        "moon",
        new Grass(512, 0.35, "rgba(240, 225, 160, 0.07)"),
        `<path d="M2 -8 A8 8 0 1 0 8 4 A6.5 6.5 0 1 1 2 -8 Z" />`,
        [Prop.moon, Prop.susuki, Prop.suzumushi, Prop.dango, Prop.susuki, Prop.susuki, Prop.suzumushi, Prop.susuki],
    )

    // 晩秋。スズメバチの巣。何層にも重なった、大きな六角形の部屋
    static readonly nest = new Scenery(
        "nest",
        new Honeycomb(56, 0.25, "rgba(255, 140, 70, 0.08)"),
        `<path d="M0 -9 L7.8 -4.5 L7.8 4.5 L0 9 L-7.8 4.5 L-7.8 -4.5 Z M-6 -2 H6 M-6 2 H6 M-3 6 H3" />`,
        [
            Prop.hornetNest,
            Prop.hornet,
            Prop.mapleLeaf,
            Prop.hornet,
            Prop.comb,
            Prop.mapleLeaf,
            Prop.hornet,
            Prop.mapleLeaf,
        ],
    )

    // ステージのフォルダ名 -> 景色。地図の左から右へ、冬から晩秋へと一年が進む
    private static readonly byArea: Readonly<Record<string, Scenery>> = {
        Test: Scenery.hive,
        Frost: Scenery.frost,
        Gale: Scenery.gale,
        Web: Scenery.web,
        Mist: Scenery.mist,
        Sand: Scenery.sand,
        Haze: Scenery.haze,
        Iron: Scenery.iron,
        Meteor: Scenery.meteor,
        Moon: Scenery.moon,
        Four: Scenery.nest,
        Champion: Scenery.nest,
    }

    // 対応する景色のないフォルダ(試作のステージなど)は巣にする
    static ofArea(area: string): Scenery {
        return Scenery.byArea[area] ?? Scenery.hive
    }
}
