import { Actor } from "./Actor"

export class Bullet extends Actor {
    r: number = 12
    radian: number = 0
    speed: number = 6
    length: number = 0
    damage: number = 1
    delay: number = 0
    isScorable: boolean = true

    appearance: "donut" | "ball" | "line" | "arrow" | "laser" | "player" = "donut"
    collision: "ball" | "line" | "arrow" | "laser" = "ball"
    type: "friend" | "enemy" | "neutral" | "effect" = "enemy"
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

        this.addScript(this.move.bind(this), { loop: Infinity })
        this.addScript(this.boundary.bind(this), { loop: Infinity })
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
        if (this.p.x < 0 || this.game.WIDTH < this.p.x || this.p.y < 0 || this.game.HEIGHT < this.p.y) {
            this.life = 0
        }
        yield
    }
}
