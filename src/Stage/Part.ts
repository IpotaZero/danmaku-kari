import { Vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"

// ボスの部位(子機)。親について動き、決まった攻撃を一つだけくり返す。親が倒れると一緒に倒れる。
// 部位を壊せば、その攻撃はなくなる。壊した瞬間、まわりの弾は得点に変わる(部位破壊のごほうび)。
// place は親から見た位置(毎フレーム呼ぶ)、attack は一回分の攻撃(終わるとまた始まる)、delay は最初の攻撃までのフレーム数
export class Part extends Enemy {
    constructor(
        game: Game,
        parent: Enemy,
        life: number,
        r: number,
        place: (me: Part) => Vec,
        attack: (me: Part) => Generator<void, void, void>,
        delay: number,
    ) {
        super(game, life, r)

        this.setParent(parent, () => place(this))
        this.addScript(() => attack(this), { loop: Infinity, margin: delay })
    }

    *onDead() {
        this.game.bullets
            .filter((b) => b.type === "enemy" && b.p.sub(this.p).magnitude() < 150)
            .forEach((b) => b.scorenize())
        this.game.camera.shake(4, 15)

        yield* super.onDead()
    }
}
