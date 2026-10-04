import { Vec } from "@ipota/vec"
import { MathEx } from "../../utils/Functions/MathEx"
import { Actor } from "./Actor"
import { Polygon } from "../BulletDrawer/Polygon"
import { uid } from "../../utils/Functions/uid"
import { Game } from "../Game"

export class Bullet extends Actor {
    r: number = 12
    radian: number = 0
    speed: number = 8
    length: number = 0
    damage: number = 1
    isScorable: boolean = true

    delay: number = 0

    appearance: "donut" | "ball" | "line" | "arrow" | "laser" | "beam" | "player" | "score" | Polygon.Type = "donut"
    collision: "circle" | "line" | "arrow" | "rect" | Polygon.Type = "circle"
    type: "friend" | "enemy" | "neutral" | "effect" | "score" = "enemy"
    color: Color = "black"
    alpha: number = 1

    private scriptReservations: [
        g: (me: Bullet) => Generator<unknown, unknown, void>,
        config: { loop?: number; margin?: number; id?: string },
    ][] = []

    clone() {
        const b = Object.assign(new Bullet(this.game), this)

        // 参照型のプロパティは共有しないよう作り直す
        b.p = this.p.clone()
        b.scriptReservations = [...this.scriptReservations]
        b.scripts = new Map()

        return b
    }

    // center を通る angle 向きの線を挟んで、自分と鏡写しになる弾(双子)を作る。
    // 双子は自分では動かず、毎フレーム自分の位置・向き・見た目・当たり判定を写し取り、自分が消えると一緒に消える
    reflection(center: Vec, angle: number): Bullet {
        const original = this
        const reflect = (p: Vec) => MathEx.reflect(p, center, angle)

        const twin = this.clone()
        twin.scriptReservations = []
        twin.speed = 0
        twin.p = reflect(this.p)
        twin.radian = 2 * angle - this.radian

        twin.bookScript(function* (me) {
            while (original.life > 0) {
                me.p = reflect(original.p)
                me.radian = 2 * angle - original.radian
                me.r = original.r
                me.alpha = original.alpha
                me.color = original.color
                me.type = original.type
                yield
            }

            me.life = 0
        })

        return twin
    }

    init() {
        this.addScript(() => this.move(this), { loop: Infinity, id: "move" })
        this.addScript(() => this.boundary(this), { loop: Infinity, id: "boundary" })

        this.scriptReservations.forEach((g) => {
            this.addScript(...g)
        })
    }

    bookScript(
        g: (me: Bullet) => Generator<unknown, unknown, void>,
        { loop = 1, margin = 0, id = uid() }: { loop?: number; margin?: number; id?: string } = {},
    ) {
        this.scriptReservations.push([g, { loop, margin, id }])
    }

    // scoreタイプに変え、自機へのホーミングを開始する
    scorenize() {
        this.type = "score"
        this.appearance = "score"
        this.r = 8
        this.alpha = 0.8
        this.color = "#befff7"
        this.isScorable = false

        this.clearScripts()

        this.addScript(() => this.homing(this), { loop: Infinity, id: "score-homing" })
        this.addScript(() => this.move(this), { loop: Infinity, id: "move" })
    }

    private *homing(me: Bullet) {
        const target = me.game.player.p.clone()
        const diff = target.sub(me.p)

        me.radian = diff.radian()
        me.speed = Math.max(diff.magnitude() / 12, 16)

        yield
    }

    private *move(me: Bullet) {
        me.p.x += Math.cos(me.radian) * me.speed
        me.p.y += Math.sin(me.radian) * me.speed
        yield
    }

    private *boundary(me: Bullet) {
        if (me.p.x < -me.r || me.game.WIDTH + me.r < me.p.x || me.p.y < -me.r || me.game.HEIGHT + me.r < me.p.y) {
            me.life = 0
        }
        yield
    }
}
