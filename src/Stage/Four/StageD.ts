import { vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Enemy } from "../../Game/Actor/Enemy"
import { Game } from "../../Game/Game"
import { Behavior, remodel } from "../../Game/Remodel"
import { Stage } from "../Stage"
import { T } from "../../T"
import { Curves } from "../../utils/Functions/Curves"
import { EnemyRendererBoss } from "../../Game/Actor/EnemyRendererBoss"
import { Part } from "../Part"
import { Charge } from "../Charge"
import { Size } from "../Size"

export default class extends Stage {
    *G() {
        const boss = new EnemyBoss(this.game)
        this.game.enemies.push(boss, ...boss.parts)

        yield* this.waitAllEnemiesDead()
        this.scorenizeAllBullets()

        yield* Array(300)
    }
}

class EnemyBoss extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.3, this.game.HEIGHT * 0.06, 2, 3)

    private readonly shells = [0, 1, 2, 3, 4, 5].map((k) => new Shell(this.game, this, k))
    private readonly snakeHead = new Head(this.game, this)
    private readonly snakeBody = [0, 1, 2, 3, 4].map((j) => new SnakeBody(this.game, this, j))

    readonly parts = [...this.shells, this.snakeHead, ...this.snakeBody]

    constructor(game: Game) {
        super(game, 2400, Size.BOSS, { renderer: new EnemyRendererBoss() })
        this.isInvincible = true

        this.scripts.add(() => this.enter())
        this.scripts.add(() => this.phases())
    }

    private *enter() {
        this.p = vec(-200, -200)
        yield* this.moveTo(this.home(), 120)

        this.scripts.add(() => this.move(), { loop: Infinity })
    }

    private home() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT * 0.2)
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 220).add(this.home())
        yield
    }

    private *phases() {
        this.scripts.add(() => this.ring(), { loop: Infinity, margin: 180, id: "body" })
        while (this.shells.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#90d0ff")

        const babies = [-1, 1].map((side) => {
            const baby = new Baby(this.game, this, side)
            const smallShells = [0, 1, 2].map((k) => new SmallShell(this.game, baby, k))
            baby.guardedBy(smallShells)
            this.game.enemies.push(baby, ...smallShells)
            return baby
        })

        this.scripts.add(() => this.tide(3), { loop: Infinity, margin: 90, id: "body" })
        while (babies.some((p) => p.life > 0)) yield

        this.scripts.remove("body")
        yield* Charge.gather(this, 150, "#a0d8ff")
        this.isInvincible = false
        this.scripts.add(() => this.tide(4), { loop: Infinity, id: "body" })
        this.scripts.add(() => this.whirlpool(), { loop: Infinity, margin: 60, id: "whirlpool" })
        this.scripts.add(() => this.silk(), { loop: Infinity, margin: 120, id: "silk" })
    }

    private *ring() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#90d0ff")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.random() * T)
            .ex(16)
            .fire(this.game.bullets)

        yield* Array(160)
    }

    private *tide(rows: number) {
        const gap = this.game.WIDTH * (0.25 + 0.5 * this.random())

        const drift = gap < this.game.WIDTH / 2 ? 45 : -45

        for (let k = 0; k < rows; k++) {
            yield* remodel(this)
                .format("small-ball")
                .r(6)
                .color("#70b8ff")
                .speed(3)
                .radian(T / 4)
                .duplicate(22, (b, i) => {
                    b.p = vec(((i + 0.5) * this.game.WIDTH) / 22, this.p.y + 40)
                    return b
                })
                .filter((b) => Math.abs(b.p.x - (gap + k * drift)) > 45)
                .g((me) => Behavior.appear(me, 30))
                .g((b) => Behavior.ease(b, "speed", 5.5, 60, Ease.In))
                .fire(this.game.bullets)
            yield* Array(24)
        }

        yield* Array(150)
    }

    private *silk() {
        const turn = this.random() < 0.5 ? -0.008 : 0.008

        yield* remodel(this)
            .color("#e8f4ff")
            .laser(40, 60, this.p.clone(), this.p.add(vec.arg(this.random() * T).scale(1500)))
            .isScorable(false)
            .ex(4)
            .g(function* (b) {
                for (let f = 0; f < 175; f++) {
                    b.p = this.p.clone()
                    if (f >= 100) b.radian += turn
                    yield
                }
            })
            .fire(this.game.bullets)

        yield* Array(260)
    }

    private *whirlpool() {
        const base = this.random() * T
        const turn = this.random() < 0.5 ? -0.012 : 0.012

        for (let f = 0; f < 60; f += 5) {
            yield* remodel(this)
                .format("diamond")
                .color("#a0d8ff")
                .p(this.p.clone())
                .speed(4)
                .radian(base + f * 0.02)
                .ex(6)
                .g((b) => Behavior.rotating(b, turn, 120))
                .fire(this.game.bullets)
            yield* Array(5)
        }

        yield* Array(150)
    }
}

class Shell extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 300, Size.M, 150)
    }

    protected place() {
        return vec.arg(this.frame / 50 + (T * this.k) / 6).scale(66)
    }

    protected *attack() {
        yield* Array(this.k * 8)

        yield* remodel(this)
            .format("big-ball")
            .r(10)
            .color("#90d0ff")
            .p(this.p.clone())
            .speed(1.5)
            .radian(this.p.sub(this.parent.p).radian())
            .nway(5, 0.22)
            .g((b) => Behavior.ease(b, "speed", 6, 45, Ease.In))
            .fire(this.game.bullets)

        yield* Array(120 - this.k * 8)
    }
}

class Head extends Part {
    constructor(game: Game, parent: Enemy) {
        super(game, parent, 600, Size.L, 170)
    }

    protected place() {
        return vec.arg(this.frame / 35).scale(140)
    }

    protected *attack() {
        yield* remodel(this)
            .format("line")
            .color("#c0ffb0")
            .p(this.p.clone())
            .speed(2)
            .aim(this.game.player)
            .nway(3, T / 30)
            .g((b) => Behavior.ease(b, "speed", 8.5, 30, Ease.In))
            .fire(this.game.bullets)

        yield* Array(55)
    }
}

class SnakeBody extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly j: number,
    ) {
        super(game, parent, 160, Size.S, 160)
    }

    protected place() {
        return vec.arg(this.frame / 35 + ((this.j + 1) * T) / 6).scale(140)
    }

    protected *attack() {
        yield* Array(this.j * 10)

        yield* remodel(this)
            .format("small-ball")
            .r(6)
            .color("#b0e8ff")
            .p(this.p.clone())
            .speed(0.5)
            .radian(T / 4)
            .nway(2, 0.3)
            .g((b) => Behavior.ease(b, "speed", 6.5, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(90 - this.j * 10)
    }
}

class Baby extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly side: number,
    ) {
        super(game, parent, 300, Size.M, 60 + (side > 0 ? 50 : 0))
    }

    protected place() {
        return vec(this.side * 120, 130)
    }

    protected *attack() {
        yield* remodel(this)
            .format("big-ball")
            .color("#c0e8ff")
            .p(this.p.clone())
            .speed(1)
            .radian(T / 4)
            .nway(3, 0.4)
            .g((b) => Behavior.ease(b, "speed", 5, 50, Ease.In))
            .fire(this.game.bullets)

        yield* Array(100)
    }
}

class SmallShell extends Part {
    constructor(
        game: Game,
        parent: Enemy,
        private readonly k: number,
    ) {
        super(game, parent, 80, Size.S, 60 + k * 30)
    }

    protected place() {
        return vec.arg(this.frame / 30 + (T * this.k) / 3).scale(60)
    }

    protected *attack() {
        yield* remodel(this)
            .format("small-ball")
            .r(5)
            .color("#b0e8ff")
            .p(this.p.clone())
            .speed(3.5)
            .radian(this.p.sub(this.parent.p).radian())
            .nway(2, 0.2)
            .fire(this.game.bullets)

        yield* Array(90)
    }
}
