import { Bark, Frost, Grass, Ground, Gust, Honeycomb, Mist, Ripple, Stones, Stream, Web } from "./Ground"
import { Prop } from "./Prop"
import { SvgFile } from "../utils/SvgFile"

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
        // 地図のノードに描く絵柄(assets/image/motif/ のSVGファイル、viewBox="-12 -12 24 24"、線は currentColor)
        readonly motif: SvgFile,
        // 地図の塊のまわりに置く小物。塊が小さくて全部は置けないときは、前にあるものから置く
        readonly props: readonly Prop[],
    ) {}

    // 巣。一年の始まりと終わりに帰ってくる所
    static readonly hive = new Scenery(
        "hive",
        new Honeycomb(40, 0.3, "rgba(255, 200, 90, 0.07)"),
        new SvgFile("assets/image/motif/hive.svg"),
        [Prop.comb, Prop.bee, Prop.honey, Prop.bee, Prop.comb, Prop.bee],
    )

    // 冬。霜の降りた野
    static readonly frost = new Scenery(
        "frost",
        new Frost(512, 0.4, "rgba(190, 225, 255, 0.09)"),
        new SvgFile("assets/image/motif/frost.svg"),
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
        new SvgFile("assets/image/motif/gale.svg"),
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
        new SvgFile("assets/image/motif/web.svg"),
        [Prop.cobweb, Prop.hangingSpider, Prop.dew, Prop.cobweb, Prop.dew, Prop.hangingSpider, Prop.dew, Prop.cobweb],
    )

    // 梅雨。霧の立ちこめる沢
    static readonly mist = new Scenery(
        "mist",
        new Mist(512, 0.25, "rgba(180, 200, 220, 0.09)"),
        new SvgFile("assets/image/motif/mist.svg"),
        [Prop.reeds, Prop.mayfly, Prop.wisp, Prop.ripple, Prop.reeds, Prop.wisp, Prop.mayfly, Prop.ripple],
    )

    // 夏。乾いた砂の崖
    static readonly sand = new Scenery(
        "sand",
        new Ripple(512, 0.5, "rgba(255, 220, 160, 0.07)"),
        new SvgFile("assets/image/motif/sand.svg"),
        [Prop.antlionPit, Prop.ants, Prop.dunes, Prop.ants, Prop.antlionPit, Prop.dunes, Prop.ants, Prop.dunes],
    )

    // 盛夏。陽炎の立つ石垣
    static readonly haze = new Scenery(
        "haze",
        new Stones(512, 0.4, "rgba(255, 170, 110, 0.07)"),
        new SvgFile("assets/image/motif/haze.svg"),
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
        new SvgFile("assets/image/motif/iron.svg"),
        [Prop.beetle, Prop.acorn, Prop.sap, Prop.acorn, Prop.beetle, Prop.sap, Prop.acorn, Prop.acorn],
    )

    // 夏の夜。星の映る河原
    static readonly meteor = new Scenery(
        "meteor",
        new Stream(512, 0.45, "rgba(150, 180, 255, 0.09)"),
        new SvgFile("assets/image/motif/meteor.svg"),
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
        new SvgFile("assets/image/motif/moon.svg"),
        [Prop.moon, Prop.susuki, Prop.suzumushi, Prop.dango, Prop.susuki, Prop.susuki, Prop.suzumushi, Prop.susuki],
    )

    // 晩秋。スズメバチの巣。何層にも重なった、大きな六角形の部屋
    static readonly nest = new Scenery(
        "nest",
        new Honeycomb(56, 0.25, "rgba(255, 140, 70, 0.08)"),
        new SvgFile("assets/image/motif/nest.svg"),
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
