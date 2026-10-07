// 敵の充電。充電中の敵には攻撃が効かず、受けた攻撃の分だけ充電が早まる。
// 撃てば早く動き出させられるが、動き出すまでは倒せない。
// 残りはcharge()の中でだけ減らす。レンダラーはisCharging()を見て、HPバーの代わりに充電バーを描く。
// 一体の敵で同時に二つ充電すると、残りが倍の速さで減ってしまうので気をつける
export class Battery {
    private remaining = 0
    private capacity = 0

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

    // frameフレームかけて充電し、満ちるまで待つ
    *charge(frame: number): Generator<void, void, void> {
        this.remaining = frame
        this.capacity = frame

        while (this.remaining > 0) {
            this.remaining--
            yield
        }
    }
}
