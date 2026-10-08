import { Vec } from "@ipota/vec"
import { Enemy } from "../Game/Actor/Enemy"
import { Game } from "../Game/Game"

// ボスの部位(子機)。親について動き、決まった攻撃を一つだけくり返す。親が倒れると一緒に倒れる。
// 部位を壊せば、その攻撃はなくなる。壊した瞬間、画面が少し揺れる。
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

    // guards(この部位の盾になる部位や孫機)がすべて倒れるまで、この部位には攻撃が効かない。
    // 攻撃が効かない間は弾が素通りするので、うしろにある guards にも弾が届く
    guardedBy(guards: readonly Enemy[]) {
        this.isInvincible = true
        this.addScript(() => this.guard(guards), { loop: Infinity, id: "guard" })
    }

    private *guard(guards: readonly Enemy[]) {
        this.isInvincible = guards.some((p) => p.life > 0)
        yield
    }
}
