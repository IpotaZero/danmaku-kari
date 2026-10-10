import { vec, Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Charge } from "../Charge"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.segments)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    readonly segments: Segment[] = []

    constructor(game: Game) {
        super(game, 1200, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true
        this.p = vec(this.game.WIDTH / 2, -200)

        for (let k = 0; k < 12; k++) {
            this.segments.push(new Segment(game, this.segments[k - 1] ?? this))
        }

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        yield* this.glide(this.home(), 150)
        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.22)
    }

    private haste() {
        return 1 + 0.05 * this.segments.filter((p) => p.life <= 0).length
    }

    private tail() {
        const alive = this.segments.filter((p) => p.life > 0)
        return alive[alive.length - 1]
    }

    private *move() {
        yield* this.slither()
        yield* this.glide(this.home(), 120)
        yield* this.shed()
        yield* this.glide(this.home(), 120)
        yield* this.constrict()
        yield* this.glide(this.home(), 120)
        yield* this.dive()
        yield* this.glide(this.home(), 120)
    }

    private *glide(end: Vec, frames: number) {
        const start = this.p.clone()

        for (let f = 1; f <= frames; f++) {
            this.p = start.add(end.sub(start).scale(Ease.InOut(f / frames)))
            yield
        }
    }

    private *slither() {
        const path = Curves.lissajous(this.game.WIDTH * 0.7, this.game.HEIGHT * 0.3, 3, 2)
        const frames = Math.floor(600 / this.haste())

        for (let f = 0; f < frames; f++) {
            this.p = path((f / frames) * T).add(this.home())

            const tail = this.tail() ?? this
            if (f % 8 === 0) {
                yield* remodel(tail)
                    .format("small-ball")
                    .r(6)
                    .color("#e0ffc0")
                    .p(tail.p.clone())
                    .speed(0.5)
                    .radian(T / 4)
                    .g((b) => Behavior.ease(b, "speed", 5, 60, Ease.In))
                    .fire(this.game.bullets)
            }

            yield
        }
    }

    private *shed() {
        const side = this.p.x < this.game.WIDTH / 2 ? 1 : -1
        const startX = this.game.WIDTH / 2 - side * this.game.WIDTH * 0.38
        yield* this.glide(vec(startX, this.game.HEIGHT * 0.3), 80)

        const frames = Math.floor(240 / this.haste())
        for (let f = 0; f < frames; f++) {
            this.p = vec(
                startX + side * this.game.WIDTH * 0.76 * Ease.InOut(f / frames),
                this.game.HEIGHT * 0.3 + 110 * Math.sin((f / frames) * T * 1.5),
            )
            yield
        }

        yield* Array(20)
        this.segments.filter((p) => p.life > 0).forEach((p, k) => p.scripts.add(() => p.shed(), { margin: k * 4 }))
        yield* Array(60)
    }

    private *constrict() {
        const center = vec(
            Math.min(Math.max(this.game.player.p.x, 130), this.game.WIDTH - 130),
            Math.min(Math.max(this.game.player.p.y, this.game.HEIGHT * 0.3), this.game.HEIGHT * 0.75),
        )
        const start = this.p.sub(center).radian()

        yield* remodel(this)
            .format("small-ball")
            .r(4)
            .type("neutral")
            .isScorable(false)
            .color("#d0ffa0")
            .speed(0)
            .duplicate(48, (b, i) => {
                b.p = center.add(vec.arg((T * i) / 48).scale(260))
                return b
            })
            .alpha(0)
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.35, 20)
                yield* Array(60)
                yield* Behavior.fadeout(b, 20)
            })
            .fire(this.game.bullets)

        yield* this.glide(center.add(vec.arg(start).scale(260)), 80)

        const frames = Math.floor(360 / this.haste())
        for (let f = 0; f < frames; f++) {
            this.p = center.add(vec.arg(start + f * 0.03).scale(260 - 170 * Ease.InOut(f / frames)))
            yield
        }
    }

    private *dive() {
        const down = this.game.WIDTH * (0.2 + 0.25 * this.random())
        const up = this.game.WIDTH - down

        yield* remodel(this)
            .appearance("laser")
            .collision("rect")
            .type("neutral")
            .isScorable(false)
            .color("#d0ffa0")
            .r(2)
            .speed(0)
            .radian(T / 4)
            .length(this.game.HEIGHT)
            .alpha(0)
            .duplicate(2, (b, i) => {
                b.p = vec(i === 0 ? down : up, 0)
                return b
            })
            .g(function* (b) {
                yield* Behavior.ease(b, "alpha", 0.2, 15)
                yield* Array(90)
                yield* Behavior.fadeout(b, 15)
            })
            .fire(this.game.bullets)

        yield* this.glide(vec(down, -150), 90)
        yield* this.glide(vec(down, this.game.HEIGHT + 250), Math.floor(110 / this.haste()))
        yield* this.glide(vec(up, this.game.HEIGHT + 250), 40)
        yield* this.glide(vec(up, -150), Math.floor(110 / this.haste()))
    }

    private *phases() {
        while (this.segments.some((p) => p.life > 0)) {
            const tail = this.tail()
            this.segments.forEach((p) => (p.isInvincible = p !== tail))
            yield
        }

        yield* Charge.gather(this, 120, "#d0ffa0")
        this.isInvincible = false
        this.scripts.add(() => this.afterimage(), { loop: Infinity, id: "afterimage" })
    }

    private *afterimage() {
        const before = this.p.clone()
        yield

        const velocity = this.p.sub(before)
        if (velocity.magnitude() < 1) return

        const across = velocity.radian() + T / 4
        const half = 40 + Math.min(velocity.magnitude() * 14, 90)

        yield* remodel(this)
            .appearance("beam")
            .collision("rect")
            .isScorable(false)
            .color("#d0ffa0")
            .r(4)
            .speed(0)
            .radian(across)
            .length(half * 2)
            .p(this.p.sub(vec.arg(across).scale(half)))
            .appear(10)
            .g(function* (b) {
                yield* Array(90)
                yield* Behavior.fadeout(b, 20)
            })
            .fire(this.game.bullets)

        yield* Array(3)
    }
}

class Segment extends Enemy {
    constructor(game: Game, leader: Enemy) {
        super(game, 150, Size.M)
        this.p = leader.p.clone()

        this.scripts.add(() => this.follow(leader), { loop: Infinity })
        this.scripts.add(() => this.rib(leader))
    }

    private *follow(leader: Enemy) {
        const diff = this.p.sub(leader.p)
        const distance = diff.magnitude()
        if (distance > 40) this.p = leader.p.add(diff.scale(40 / distance))
        yield
    }

    private *rib(leader: Enemy) {
        const me = this

        yield* remodel(this)
            .appearance("beam")
            .collision("rect")
            .isScorable(false)
            .color("#d0ffa0")
            .r(4)
            .speed(0)
            .length(this.r * 2)

            .unbounded()
            .g(function* (b) {
                let before = me.p.clone()
                let half = me.r

                while (me.life > 0) {
                    const speed = me.p.sub(before).magnitude()
                    before = me.p.clone()

                    half += (me.r + Math.min(speed * 14, 70) - half) * 0.15
                    b.radian = leader.p.sub(me.p).radian() + T / 4
                    b.length = half * 2
                    b.p = me.p.sub(vec.arg(b.radian).scale(half))
                    yield
                }

                yield* Behavior.fadeout(b, 15)
            })
            .fire(this.game.bullets)
    }

    *shed() {
        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#f0ffe0")
            .speed(0)
            .duplicate(10, (b, i) => {
                b.p = this.p.add(vec.arg((T * i) / 10).scale(this.r + 4))
                return b
            })
            .appear(40)
            .g(function* (b) {
                yield* Array(100)
                b.radian = T / 4 + (this.random() - 0.5) * 0.6
                yield* Behavior.accel(b, 60, 2 + this.random() * 1.5)
            })
            .fire(this.game.bullets)
    }
}
