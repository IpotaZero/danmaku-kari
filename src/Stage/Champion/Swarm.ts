import { Vec, vec } from "@ipota/vec"
import { Bullet } from "../../Game/Actor/Bullet"
import { Enemy } from "../../Game/Actor/Enemy"
import { Behavior, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// チャンピオンの「群れ」。
// 蜂の弾は群れで飛ぶ。仲間に寄り集まり、仲間と向きをそろえ、ぶつかりそうな仲間からは離れ、そのうえで自機を追いかける。
// ただし急には曲がれないので、自機が大きく動けば行き過ぎて、ぐるりと回って戻ってくる。
// ときどき群れは色を変えて身構え、そのあと一気に自機めがけて突っ込んでくる(突撃)
export namespace Swarm {
    const BEE: Color = "#ffd040"
    const ALERT: Color = "#ff6040"

    // 長さ1にした向き。長さ0なら0のまま(そのまま normalize すると NaN になる)
    function unit(v: Vec): Vec {
        const length = v.magnitude()
        return length === 0 ? v : v.scale(1 / length)
    }

    export type Config = {
        // 普段の速さの上限と、1フレームに変えられる速度の上限(小さいほど曲がりにくい)
        speed: number
        force: number
        // 仲間が見える距離と、近すぎる距離
        view: number
        personal: number
        // 寄り集まる・向きをそろえる・離れる・自機を追う の強さ
        cohesion: number
        alignment: number
        separation: number
        chase: number
        // 蜂が飛んでいる時間
        life: number
    }

    export class Flock {
        private bees: Bullet[]
        // 突撃の構え(0なら普段、1なら身構え、2なら突撃中)
        private mode: number

        constructor(
            private readonly e: Enemy,
            private readonly config: Config,
        ) {
            this.bees = []
            this.mode = 0
        }

        // from のまわりから count 匹の蜂を放つ
        release(from: Vec, count: number) {
            const flock = this
            const config = this.config

            return remodel(this.e)
                .format("wedge")
                .r(10)
                .color(BEE)
                .p(from.clone())
                .speed(config.speed)
                .duplicate(count, (b, i) => {
                    b.radian = (T * i) / count
                    b.p = from.add(vec.arg(b.radian).scale(20))
                    return b
                })
                .appear(20)
                .g(function* (me) {
                    flock.bees.push(me)
                    yield* Array(config.life)
                    yield* Behavior.fadeout(me, 30)
                })
        }

        // e が生きている間、群れを飛ばす
        *fly() {
            const { game } = this.e

            while (this.e.life > 0) {
                this.bees = this.bees.filter((b) => b.life > 0)
                const speed = this.config.speed * (this.mode === 2 ? 2 : 1)
                const chase = this.config.chase * (this.mode === 2 ? 4 : 1)
                const force = this.config.force * (this.mode === 2 ? 2.5 : 1)
                const velocities = this.bees.map((b) => vec.arg(b.radian).scale(b.speed))

                this.bees.forEach((me, i) => {
                    if (me.type !== "enemy") return

                    let center = vec(0, 0)
                    let heading = vec(0, 0)
                    let away = vec(0, 0)
                    let neighbors = 0

                    this.bees.forEach((other, j) => {
                        if (i === j) return
                        const d = other.p.sub(me.p)
                        const r = d.magnitude()
                        if (r > this.config.view || r === 0) return

                        neighbors++
                        center = center.add(other.p)
                        heading = heading.add(velocities[j])
                        if (r < this.config.personal) away = away.sub(d.scale(1 / r))
                    })

                    let steer = unit(game.player.p.sub(me.p)).scale(chase)

                    if (neighbors > 0) {
                        steer = steer
                            .add(unit(center.scale(1 / neighbors).sub(me.p)).scale(this.config.cohesion))
                            .add(unit(heading).scale(this.config.alignment))
                            .add(unit(away).scale(this.config.separation))
                    }

                    // 画面の端に近づいたら内側へ戻る
                    const margin = 30
                    if (me.p.x < margin) steer = steer.add(vec(1, 0))
                    if (me.p.x > game.WIDTH - margin) steer = steer.add(vec(-1, 0))
                    if (me.p.y < margin) steer = steer.add(vec(0, 1))
                    if (me.p.y > game.HEIGHT - margin) steer = steer.add(vec(0, -1))

                    const desired = steer.magnitude() === 0 ? velocities[i] : unit(steer).scale(speed)
                    let change = desired.sub(velocities[i])
                    if (change.magnitude() > force) change = unit(change).scale(force)

                    const v = velocities[i].add(change)
                    me.radian = v.radian()
                    me.speed = Math.min(v.magnitude(), speed)
                    me.color = this.mode === 1 ? (this.e.frame % 8 < 4 ? ALERT : BEE) : BEE
                })

                yield
            }
        }

        // 突撃。warn フレーム身構えて(色が明滅する)から、frames の間速く鋭く自機を追う
        *dive(warn: number, frames: number) {
            this.mode = 1
            yield* Array(warn)
            this.mode = 2
            yield* Array(frames)
            this.mode = 0
        }
    }
}
