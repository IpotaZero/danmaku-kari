import { vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"
import { Remodel, remodel } from "../Game/Remodel"
import { Stage } from "./Stage"
import { EnemyRendererCore } from "../Game/Actor/EnemyRendererCore"
import { T } from "../T"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["...."])

        const parent = new EnemyGate(this.game)
        this.game.enemies.push(parent)
        this.game.enemies.push(new EnemySatellite(this.game, parent, 1))
        this.game.enemies.push(new EnemySatellite(this.game, parent, -1))

        yield* this.waitAllEnemiesDead()
        this.shake(16, 60)
        this.flash("#ffffff", 12)
        this.scorenizeAllBullets()
    }
}

class EnemyTest extends Enemy {
    constructor(game: Game) {
        super(game, 1000, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.move())
    }

    private *move() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), 150)

        this.addScript(() => this.G(), { loop: Infinity })
    }

    private *G() {
        yield* remodel(this)
            .colorful(this.frame)
            .p(this.p.clone())
            .aim(this.game.player.p)
            .ex(31)
            .delayByIndex()
            .g((me, i) => Remodel.reaccel(me, 30, 30 - i, 30))
            .fire(this.game.bullets)

        yield* Array(30)
    }
}

// 自機狙いを使わず、静止だけでは安置ができないようにした敵。
// 螺旋は曲がる弾自身が空間を掃くことで、壁は隙間の幅を距離によらず一定にすることで、
// それぞれ別の理由で「動き続ける」ことを要求する。左右に子機を従え、攻撃の起点も増やす
class EnemyGate extends Enemy {
    constructor(game: Game) {
        super(game, 2400, 48)

        this.addScript(() => this.move())
    }

    private *move() {
        yield* this.moveTo(vec(this.game.WIDTH / 2, this.game.HEIGHT / 4), 150)

        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *attack() {
        yield* this.spiral()
        yield* this.gate()
        yield* Array(40)
    }

    // 発射時の向きで避けさせるのではなく、弾自身が飛びながら曲がっていく本来の意味での螺旋弾。
    // ずっと同じ角速度で曲げ続けると、速度/角速度で決まる半径の円軌道を描いて発生源の周りを
    // 回り続けるだけになり画面外まで飛ばない(前回の実装のバグ)。曲がるのは最初の一定フレームだけにし、
    // その後は直進させることで、フックのように曲がってからちゃんと画面下まで抜けるようにする
    private *spiral() {
        const shotCount = 22
        const shotInterval = 12
        const curveSpeed = T / 200
        const curveFrames = 50

        for (let i = 0; i < shotCount; i++) {
            if (i % 5 === 4) {
                yield* this.spiralPulse()
            } else {
                yield* this.spiralCurve(i % 2 === 0 ? 1 : -1, curveSpeed, curveFrames)
            }

            yield* Array(shotInterval)
        }
    }

    // 曲がりながら飛ぶ弾。自機のいる下方向を中心にした扇の範囲でだけ初速の向きを振ることで、
    // 自機狙いはせずとも画面下へ確実に届くようにする
    private *spiralCurve(dir: 1 | -1, curveSpeed: number, curveFrames: number) {
        const baseAngle = T / 4 + Math.sin(this.frame / 30) * (T / 8)

        yield* remodel(this)
            .colorful(this.frame)
            .p(this.p.clone())
            .appearance("ball")
            .r(6)
            .radian(baseAngle)
            .speed(2.6)
            .nway(3, T / 10)
            .g(function* (me) {
                for (let i = 0; i < curveFrames; i++) {
                    me.radian += curveSpeed * dir
                    yield
                }
            })
            .fire(this.game.bullets)
    }

    // 曲がらない、太くて速いリング弾。「今避けないと当たる」という決めどころを作る。
    // 見た目(arrow)と当たり判定の形を一致させるため、collisionも明示的にarrowに合わせる
    private *spiralPulse() {
        yield* remodel(this)
            .colorful(this.frame)
            .p(this.p.clone())
            .appearance("arrow")
            .collision("arrow")
            .r(18)
            .radian(this.frame * 0.1)
            .speed(4.6)
            .ex(14)
            .fire(this.game.bullets)
    }

    // 中心から放射状に隙間を空ける方式だと、進むほど隙間の物理的な幅が広がってしまい
    // 機能しなくなる(半径に隙間の角度を掛けた分だけ広がるため)。
    // そこで全弾を平行に降らせるカーテン状にし、隙間の幅が距離に関係なく一定になるようにする。
    // 見た目はballにする。lineの当たり判定は弾の進行方向に沿った線分になるため、
    // 縦に落ちる壁に使うと左右方向の判定幅が実質ゼロになり見た目と乖離した状態で素通りできてしまう。
    // ballなら見た目の円と当たり判定が完全に一致するので、この壁の用途にはballしか使えない
    private *gate() {
        const laneWidth = 32
        const laneCount = Math.floor(this.game.WIDTH / laneWidth)
        const gapLanes = 2
        const rows = 3
        const rowSpacing = 40
        const speed = 2.4
        // 隙間の位置を波ごとに大きく飛ばし、次の隙間を予測して動き続けさせる
        const gapRatios = [0.15, 0.85, 0.3, 0.7, 0.5]

        for (const ratio of gapRatios) {
            const gapStart = Math.round(ratio * (laneCount - gapLanes))

            yield* remodel(this)
                .colorful(this.frame * 3)
                .appearance("ball")
                .r(24)
                .radian(T / 4)
                .speed(speed)
                .duplicate(laneCount - gapLanes, (b, i) => {
                    const lane = i < gapStart ? i : i + gapLanes
                    b.p = vec(lane * laneWidth + laneWidth / 2, 0)
                    return b
                })
                .duplicate(rows, (b, row) => {
                    b.p = vec(b.p.x, b.p.y - row * rowSpacing)
                    return b
                })
                .fire(this.game.bullets)

            // 難易度は隙間の狭さで出しているので、波の間隔は余裕を持たせて連続で詰めすぎない
            yield* Array(80)
        }
    }
}

// 親の周りを回りながら外周へ弾を撃つ子機。攻撃の起点を親から離すことで、
// 親基準では安置に見える位置にも弾を届かせる
class EnemySatellite extends Enemy {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: 1 | -1,
    ) {
        super(game, 300, 20)

        this.setParent(parent, () => vec(Math.cos(this.frame / 240) * 140 * this.side, Math.sin(this.frame / 240) * 60))

        this.addScript(() => this.startAttack())
    }

    private *startAttack() {
        yield* Array(150)

        this.addScript(() => this.attack(), { loop: Infinity })
    }

    private *attack() {
        yield* remodel(this)
            .colorful(this.frame * 5)
            .p(this.p.clone())
            .appearance("donut")
            .r(12)
            .radian(this.frame * 0.3)
            .speed(3.0)
            .ex(3)
            .fire(this.game.bullets)

        yield* Array(15)
    }
}
