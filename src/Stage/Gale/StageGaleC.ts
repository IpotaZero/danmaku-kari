import { vec } from "@ipota/vec"
import { GenUtils } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore"
import { Curves } from "../../utils/Functions/Curves"
import { T } from "../../T"
import { Tornado } from "./Tornado"

// ステージ「竜巻」(疾風道場・師範代)
// 画面の端に、上から下まで届く竜巻が立ち、回りながら反対の端まで横切っていく。
// 竜巻は弾を楕円に並べた輪を縦に積んだもので、輪は回っている。
// 輪の奥側にある弾は薄く、当たり判定がない。手前に回ってきた弾だけが実体になる。
// 輪ごとに少しずつ回り方がずれているので、手前の弾は斜めの縞になって竜巻の表面を流れていく(床屋のサインポール)。
// 竜巻は画面の縦いっぱいなので、どこかで縞と縞の間に入って、縞と一緒に流れながら向こう側へ抜けるしかない。
// 竜巻が抜けたあと、休憩をはさんで、今度は反対の端から竜巻が立つ。
// 師範代の周りを回る2匹の木の葉(衛星)が、ゆっくりした矢を自機へ投げてくる。

const ENTRANCE_FRAMES = 150
// 1周期の長さ。竜巻が抜けた後、2秒半ほど休憩が入る
const CYCLE_FRAMES = Tornado.TOTAL_FRAMES + 150

const LEAF_LIFE = 700

export default class extends Stage {
    *G() {
        const master = new EnemyMaster(this.game)
        this.game.enemies.push(master, new EnemyLeaf(this.game, master, 0), new EnemyLeaf(this.game, master, 1))

        yield* this.waitAllEnemiesDead()
    }
}

class EnemyMaster extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.04, 1, 2)

    constructor(game: Game) {
        // 主機の体力は衛星の総和くらい
        super(game, LEAF_LIFE * 2, 48, { renderer: new EnemyRendererCore() })

        this.addScript(() => this.enter())
    }

    private *enter() {
        yield* this.moveTo(this.home(), ENTRANCE_FRAMES)

        this.addScript(() => this.move(), { loop: Infinity })
        this.addScript(() => this.cycle(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.15)
    }

    private *move() {
        this.p = this.path((this.frame - ENTRANCE_FRAMES) / 1500).add(this.home())
        yield
    }

    // 左右交互に竜巻を立てる
    private *cycle() {
        for (const side of [-1, 1]) {
            yield* GenUtils.all({
                tornado: Tornado.spin(remodel(this), this.game, side, this.random() * T)
                    .color("#b8ffd8")
                    .fire(this.game.bullets),
                wait: Array(CYCLE_FRAMES),
            })
        }
    }
}

class EnemyLeaf extends Enemy {
    constructor(game: Game, parent: Enemy, index: number) {
        super(game, LEAF_LIFE, 24)

        this.setParent(parent, () => vec.arg(this.frame / 200 + (T / 2) * index).scale(110))

        this.addScript(() => this.cycle(), { margin: ENTRANCE_FRAMES + Tornado.FORM_FRAMES + index * 60, loop: Infinity })
    }

    // 3本の矢を、最初はゆっくり、だんだん速く投げる
    private *cycle() {
        yield* remodel(this)
            .format("arrow")
            .color("#ffe9a8")
            .p(this.p.clone())
            .speed(0.5)
            .aim(this.game.player.p)
            .nway(3, T / 20)
            .g((me) => Behavior.accel(me, 90, 3.5))
            .fire(this.game.bullets)

        yield* Array(120)
    }
}
