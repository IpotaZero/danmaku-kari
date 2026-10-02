import { Vec, vec } from "@ipota/vec";
import { Enemy } from "../../Game/Actor/Enemy";
import { Game } from "../../Game/Game";
import { Behavior, remodel } from "../../Game/Remodel";
import { Stage } from "../Stage";
import { EnemyRendererCore } from "../../Game/Actor/EnemyRendererCore";
import { Curves } from "../../utils/Functions/Curves";
import { T } from "../../T";

export default class extends Stage {
    *G() {
        this.game.enemies.push(new EnemyCore(this.game));
        yield* this.waitAllEnemiesDead();
    }
}

class EnemyCore extends Enemy {
    private readonly path = Curves.lissajous(this.game.WIDTH * 0.8, this.game.HEIGHT * 0.4, 5, 6);

    constructor(game: Game) {
        super(game, 1200, 48, { renderer: new EnemyRendererCore() });

        this.addScript(() => this.enter());
    }

    private center() {
        return vec(this.game.WIDTH / 2, this.game.HEIGHT / 4);
    }

    private *enter() {
        yield* this.moveTo(this.center(), 120);

        this.addScript(() => this.move(), { loop: Infinity });
        this.addScript(() => this.attack(), { loop: Infinity });
    }

    private *move() {
        this.p = this.path((this.frame - 120) / 900).add(this.center());
        yield;
    }

    private *attack() {
        yield* Array(120);
        yield* remodel(this)
            .format("arrow")
            .radian(20)
            .color("#bbffaa")
            .speed(5)
            .p(this.p)
            .nway(5, T / 8)
            .g(function* (me) {
                yield* Array(30);
                yield* Behavior.aim(me, this.game.player.p, 30);
                while (true) {
                    me.radian = T / 4 + (T / 8) * Math.sin((T / 64) * this.frame);
                    yield;
                }
            })
            // .aim(this.game.player.p)
            .fire(this.game.bullets);
    }
}
