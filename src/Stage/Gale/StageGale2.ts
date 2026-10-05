import { Vec, vec } from "@ipota/vec";
import { Enemy } from "../../Game/Actor/Enemy";
import { Game } from "../../Game/Game";
import { Behavior, remodel } from "../../Game/Remodel";
import { Stage } from "../Stage";
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore";
import { Curves } from "../../utils/Functions/Curves";
import { T } from "../../T";
import { GenUtils } from "../../utils/Functions/GeneratorUtils";

export default class extends Stage {
    *G() {
        const parent = new EnemyCore(this.game);
        this.game.enemies.push(
            parent,
            new EnemyAim(this.game, parent, T / 2),
            new EnemyAim(this.game, parent, 0),
            new EnemyAim(this.game, parent, T / 4),
            new EnemyAim(this.game, parent, (T * 3) / 4),
        );
        yield* this.waitAllEnemiesDead();
    }
}

const loopTime = 680;

class EnemyAim extends Enemy {
    constructor(game: Game, parent: Enemy, radian: number) {
        super(game, 1000, 30);
        this.setParent(parent, () => vec.arg(radian + this.frame / 300).scale(parent.r + this.r));
        this.addScript(() => this.attack(), { loop: Infinity, margin: 120 });
    }

    private *fire() {
        yield* remodel(this)
            .format("big-ball")
            .color("#ffcbaa")
            .p(this.p)
            .speed(2)
            .radian(T / 4)
            .g(function* (me) {
                yield* Behavior.stop(me, 30);
                yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame;
                const startRadian = me.radian;

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 32) * (this.frame - startFrame));
                            yield;
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 8),
                });
            })
            .fire(this.game.bullets);
    }

    private *fire2() {
        yield* remodel(this)
            .format("diamond")
            .color("#ffcbaa")
            .p(this.p)
            .speed(2)
            .nway(10, T / 10)
            .appear(20, 2)
            .colorful(Math.random() * 100)
            // .radian(T / 4)
            .g(function* (me) {
                yield* Behavior.stop(me, 30);
                // yield* Behavior.aim(me, this.game.player.p, 30);
                const startFrame = this.frame;
                const startRadian = me.radian;

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 16) * Math.sin((T / 32) * (this.frame - startFrame));
                            yield;
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 4),
                });
            })
            .fire(this.game.bullets);
    }

    private *multipleFire() {
        for (let i = 0; i < 4; i++) {
            yield* Array(120);
            yield* this.fire();
            yield* this.fire2();
        }
        yield* Array(120);
    }

    private *attack(): Generator<void, void, void> {
        yield* GenUtils.all({ attack: this.multipleFire(), wait: Array(loopTime) });
    }
}

class EnemyCore extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.2, this.game.HEIGHT * 0.3, 3, 3);

    constructor(game: Game) {
        super(game, 1800, 48, { renderer: new EnemyRendererCore() });
        this.addScript(() => this.enter());
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4);
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120);

        this.addScript(() => this.move(), { loop: Infinity });
        this.addScript(() => this.attack(), { loop: Infinity });
        // this.addScript(() => this.attack2(), { loop: Infinity });
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 900).add(this.center());
        yield;
    }

    private *fire() {
        yield* remodel(this)
            .format("donut")
            .radian(40)
            .p(this.p)
            .color("#bbffaa")
            .speed(4)
            .nway(12, T / 12)
            .appear(20, 2)
            .g(function* (me) {
                yield* Behavior.stop(me, 40);
                yield* Array(70);
                yield* Behavior.aim(me, vec(this.game.player.p.x, this.game.HEIGHT * 2), 1);
                const startFrame = this.frame;
                const startRadian = me.radian;

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 32) * Math.sin((T / 64) * (this.frame - startFrame));
                            yield;
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 4),
                });
            })
            .fire(this.game.bullets);
    }

    private *fire3() {
        yield* remodel(this)
            .format("donut")
            .radian(40)
            .p(this.p)
            .color("#aa4444")
            .speed(10)
            .nway(20, T / 20)
            .appear(20, 2)
            .g(function* (me) {
                yield* Behavior.stop(me, 60);
                yield* Array(50);
                yield* Behavior.aim(me, vec(this.game.player.p.x, this.game.HEIGHT * 2), 1);
                const startFrame = this.frame;
                const startRadian = me.radian;

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 32) * Math.sin((T / 64) * (this.frame - startFrame));
                            yield;
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 4),
                });
            })
            .fire(this.game.bullets);
    }
    private *fire4() {
        yield* remodel(this)
            .format("donut")
            .radian(40)
            .p(this.p)
            .color("#aaaa44")
            .speed(8)
            .nway(16, T / 16)
            .appear(20, 2)
            .g(function* (me) {
                yield* Behavior.stop(me, 50);
                yield* Array(60);
                yield* Behavior.aim(me, vec(this.game.player.p.x, this.game.HEIGHT * 2), 1);
                const startFrame = this.frame;
                const startRadian = me.radian;

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 32) * Math.sin((T / 64) * (this.frame - startFrame));
                            yield;
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 4),
                });
            })
            .fire(this.game.bullets);
    }

    private *fire2() {
        yield* remodel(this)
            .format("donut")
            .radian(20)
            .color("#bbffaa")
            .speed(6)
            .p(this.p)
            .nway(10, T / 10)
            .g(function* (me) {
                yield* Behavior.stop(me, 30);
                yield* Behavior.aim(me, vec(this.game.player.p.x, this.game.HEIGHT * 2), 1);
                const startFrame = this.frame;
                const startRadian = me.radian;

                yield* GenUtils.all({
                    move: function* (this: Enemy) {
                        while (true) {
                            me.radian = startRadian + (T / 8) * Math.sin((T / 64) * (this.frame - startFrame));
                            yield;
                        }
                    }.bind(this)(),
                    accel: Behavior.accel(me, 30, 3),
                });
            })
            // .scatter({ radian: [T / 2, (T * 3) / 2] })
            .fire(this.game.bullets);
    }

    private *multipleFire() {
        yield* Array(180);
        yield* this.fire2();
        yield* Array(180);
        yield* this.fire();
        yield* this.fire3();
        yield* this.fire4();
    }

    private *attack(): Generator<void, void, void> {
        yield* GenUtils.all({ attack: this.multipleFire(), wait: Array(loopTime) });
    }
}
