import { Actor } from "./Actor"

export class Bullet extends Actor {
    r: number = 12
    radian: number = 0
    speed: number = 1
    length: number = 0
    damage: number = 1
    delay: number = 0
    isScorable: boolean = true

    appearance: "donut" | "ball" | "line" | "arrow" | "laser" | "beam" | "player" | "score" | "triangle" = "donut"
    collision: "circle" | "line" | "arrow" | "rect" = "circle"
    type: "friend" | "enemy" | "neutral" | "effect" | "score" = "enemy"
    color: Color = "black"
    alpha: number = 1

    private genfs: [g: (me: Bullet) => Generator<void, void, void>, config: { loop?: number; margin?: number }][] = []

    clone(): this {
        const b = { ...this }

        b.p = this.p.clone()
        b.genfs = [...this.genfs]
        b.scripts = new Map()
        // @ts-ignore
        b.__proto__ = this.__proto__

        return b
    }

    init() {
        this.genfs.forEach((g) => {
            this.addScript(...g)
        })

        this.addScript(this.move.bind(this), { loop: Infinity, id: "move" })
        this.addScript(this.boundary.bind(this), { loop: Infinity, id: "boundary" })
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

        this.addScript(() => this.homing(), { loop: Infinity, id: "score-homing" })
        this.addScript(() => this.move(), { loop: Infinity, id: "move" })
    }

    private *homing() {
        const target = this.game.player.p.clone()
        const diff = target.sub(this.p)

        this.radian = diff.radian()
        this.speed = Math.max(diff.magnitude() / 12, 8)

        yield
    }

    addScriptBook(
        g: (me: Bullet) => Generator<void, void, void>,
        { loop = 1, margin = 0 }: { loop?: number; margin?: number } = {},
    ) {
        this.genfs.push([g, { loop, margin }])
    }

    private *move() {
        this.p.x += Math.cos(this.radian) * this.speed
        this.p.y += Math.sin(this.radian) * this.speed
        yield
    }

    private *boundary() {
        if (
            this.p.x < -this.r ||
            this.game.WIDTH + this.r < this.p.x ||
            this.p.y < -this.r ||
            this.game.HEIGHT + this.r < this.p.y
        ) {
            this.life = 0
        }
        yield
    }
}
