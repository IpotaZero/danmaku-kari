// 敵の充電。充電中の敵は何もしない。攻撃は効かず、受けた攻撃の分だけ充電が早まる。
// 撃てば早く動き出させられるが、動き出すまでは倒せない。
// 充電中はEnemy.update()がスクリプトを進めないので、充電中に何かを動かす(演出する)ことは構造上できない。
// 動き続けるのは、親への追従と被弾で膨らむ見た目と、frame(レンダラーの見た目に使う)だけ。
// 充電の長さは作るときにだけ決まり、残りは減る一方。あとから充電を始め直す手段はない
export class Battery {
    private remaining: number
    private readonly capacity: number

    // frameが0なら、充電しない
    constructor(frame: number) {
        this.remaining = frame
        this.capacity = frame
    }

    isCharging() {
        return this.remaining > 0
    }

    // 充電の進み具合(0〜1)。充電中にだけ意味を持つ
    ratio() {
        return 1 - this.remaining / this.capacity
    }

    // 攻撃を充電にまわす。充電中でなければ何もせずfalseを返す
    absorb(damage: number) {
        if (!this.isCharging()) return false

        this.remaining -= damage
        return true
    }

    tick() {
        this.remaining--
    }
}
