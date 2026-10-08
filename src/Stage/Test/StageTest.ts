import { vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { Figure } from "../Figure"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { T } from "../../T"
import { GenUtils } from "@ipota/functions"
import { Curves } from "../../utils/Functions/Curves"
import { isSmartPhone } from "../../utils/Functions/isSmartPhone"
import { dash } from "../../Game/Equipment/Dash"

// ボスの登場演出にかかるフレーム数。衛星もこれだけ待ってから合わせて動き出す
const ENTRANCE_FRAMES = 150
// 一斉射撃の後の休憩フレーム数。ボスと衛星の両方がこの数値だけ待つことで、
// お互いを一切参照せずとも常に同じフレームで発射できる
const REST_FRAMES = 240

// 序章「巣」。八日前の夜、秋の終わりに羽化したばかりのハチノコが、姉のミツに飛び方を教わる。
// スズメバチの偵察を二度落とすが、巣にはもう仲間を呼ぶ印をつけられていて、その夜、巣は襲われる。
export default class extends Stage {
    *G() {
        yield* this.narrate("十一月の終わり。山の中腹、古い杉の洞。", "蜜蜂の巣。")

        this.showFigure(Figure.hachinokoSmile)
        yield* this.talk("ミツ", "羽、乾いた?")
        yield* this.talk("ハチノコ", "うん。")
        yield* this.talk("ミツ", "じゃあ今夜は、わたしの横で見張りを覚えて。", "秋はね、怖いのが来るから。")
        this.showFigure(Figure.hachinoko)

        if (isSmartPhone) {
            yield* this.talk("ミツ", "指でなぞった方へ飛ぶの。")
        } else {
            yield* this.talk("ミツ", "矢印キーで飛ぶの。Shiftを押してるあいだは、ゆっくり。")
        }
        yield* this.talk("ミツ", "針は勝手に出る。前にいるやつに当てればいい。")

        yield* this.talk("ハチノコ", "……何か来る。")
        yield* this.talk("ミツ", "スズメバチの偵察。一匹でも帰したら、だめ。")
        this.hideFigure(Figure.hachinoko)

        const parent = new EnemyBoss(this.game)
        this.game.enemies.push(parent)

        const satelliteCount = 3
        for (let i = 0; i < satelliteCount; i++) {
            this.game.enemies.push(new EnemySatellite(this.game, parent, i, satelliteCount))
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* this.talk("ミツ", "……遅かった。入り口に、匂いをつけられてる。")
        yield* this.talk("ハチノコ", "匂い?")
        yield* this.talk("ミツ", "仲間を呼ぶ印。今夜、群れで来る。")

        if (this.game.player.isEquipped(dash)) {
            if (isSmartPhone) {
                yield* this.talk(
                    "ミツ",
                    "危ないときは、二本指でたたいて。<br>一瞬だけ速く飛べる。そのあいだは、何にも当たらない。",
                )
            } else {
                yield* this.talk("ミツ", "危ないときは、Ctrl。<br>一瞬だけ速く飛べる。そのあいだは、何にも当たらない。")
            }
        } else {
            if (isSmartPhone) {
                yield* this.talk("ミツ", "二本指でたたくと、技が出る。<br>……それ、わたしの知らない飛び方だね。")
            } else {
                yield* this.talk("ミツ", "Ctrlで、技が出る。<br>……それ、わたしの知らない飛び方だね。")
            }
        }

        yield* this.talk("ハチノコ", "また来る。")
        yield* this.talk("ミツ", "先ぶれ。本隊が着く前に、落とす。")

        const parent2 = new EnemyBoss(this.game)
        this.game.enemies.push(parent2)

        const satelliteCount2 = 3
        for (let i = 0; i < satelliteCount2; i++) {
            this.game.enemies.push(new EnemySatellite(this.game, parent2, i, satelliteCount2))
        }

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(60)

        this.showFigure(Figure.hachinoko)
        yield* this.talk("ミツ", "ハチノコ。巣房に入って。朝まで、出ちゃだめ。")
        yield* this.talk("ハチノコ", "ねえさんは?")
        yield* this.talk("ミツ", "蜂球。みんなで、あいつらを包むの。", "熱いのは、得意なんだ。わたしたち。")
        this.hideFigure(Figure.hachinoko)

        yield* this.narrate("その夜、羽音が巣を埋めつくした。")
        yield* this.narrate("朝。")

        this.showFigure(Figure.hachinoko)
        yield* this.talk("ハチノコ", "ねえさん。")
        yield* this.narrate("返事はなかった。")
        yield* this.narrate(
            "巣の入り口に、蜂球の跡があった。<br>スズメバチの死骸がひとつ。そのまわりに、姉たちがたくさん。",
            "巣房は、どれも空だった。<br>幼虫も、蛹も。",
        )
        yield* this.talk("ハチノコ", "……妹たちは。")
        yield* this.narrate("スズメバチの死骸に、針が一本、刺さったまま残っていた。", "ハチノコは、それを抜いた。")
        this.hideFigure(Figure.hachinoko)
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.4, 3, 4)

    constructor(game: Game) {
        super(game, 1500, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 900).add(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4))
        yield
    }

    // 「弾を並べて溜める(提示) → 一斉に加速して襲いかかる → 何もない静寂」を1セットとする
    private *attack() {
        yield* GenUtils.all({
            attack: this.radialVolley(),
            wait: Array(REST_FRAMES),
        })
    }

    // ボスの全方位に近い扇
    // reaccelで一旦飛び出してから減速・静止・再加速させることで、出現位置の一点に重ならず放射状に広がる
    private *radialVolley() {
        const stopFrames = 40
        const waitFrames = 20
        const accelFrames = 60
        const launchSpeed = 6

        // delayByIndexを使うことでリボンスプレッドのような効果を生み出すことができる。

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("ball")
            .r(4)
            .speed(8)
            .color("#ffffff")
            .aim(this.game.player)
            .nway(13, T / 120)
            .delayByIndex()
            .g(function* (me, i) {
                yield* Behavior.reaccel(me, stopFrames, waitFrames - i, accelFrames, launchSpeed)
            })
            .fire(this.game.bullets)
    }
}

class EnemySatellite extends Enemy {
    constructor(
        game: Game,
        private readonly parent: Enemy,
        index: number,
        count: number,
    ) {
        super(game, 500, 20)

        // 公転半径を大きくすることで、異なる方向からの攻撃を見せることができる。
        // 異なる方向からの攻撃を実現するためには横幅が必要である。
        // 極論、砲塔以外から攻撃してもよいのだ。
        const phase = (T * index) / count
        const orbitSpeed = T / 2400
        const radius = 250

        this.setParent(parent, () => vec.arg(phase + this.frame * orbitSpeed).scale(radius))

        this.addScript(() => this.attack(), { margin: ENTRANCE_FRAMES, loop: Infinity })
    }

    // ボスを一切見ず、ボスと全く同じフレーム数だけ待つことで結果的に同時発射になる
    private *attack() {
        yield* GenUtils.all({
            attack: this.fireAimed(5, T / 16, 10, 6),
            wait: Array(REST_FRAMES),
        })

        yield* GenUtils.all({
            attack: this.fireAimed(3, T / 14, 10, 6),
            wait: Array(REST_FRAMES),
        })
    }

    private *fireAimed(nway: number, angle: number, waitFrames: number, launchSpeed: number) {
        if (this.life <= 0) return

        const stopFrames = 40
        const accelFrames = 60

        yield* remodel(this)
            .p(this.p.clone())
            .appearance("donut")
            .r(12)
            .speed(6)
            .color("#ff3366")
            .aim(this.game.player)
            .nway(nway, angle)
            .delayByIndex()
            .g(function* (me, i) {
                yield* Behavior.reaccel(me, stopFrames, waitFrames - i, accelFrames, launchSpeed)
            })
            .fire(this.game.bullets)
    }
}
