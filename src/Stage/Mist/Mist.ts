import { Vec } from "@ipota/vec"
import { Ease } from "@ipota/functions"
import { Actor } from "../../Game/Actor/Actor"
import { Bullet } from "../../Game/Actor/Bullet"
import { Game } from "../../Game/Game"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 霧の沢の「霧」。
// 弾は二つの組(phase 0 と 1)に分かれ、時計に合わせて交互に実体と霧(薄く、当たり判定なし)になる。
// 霧になるときは薄れ始めた瞬間に当たり判定が消え、実体になるときは濃くなりきった瞬間に当たり判定が生まれる。
// どちらの組も同じ時計を見るので、画面じゅうの弾が一斉に入れ替わる。
export namespace Mist {
    const MIST_ALPHA = 0.15

    export class Clock {
        // period: 二つの組が一度ずつ実体になるまでの長さ。fade: 薄れる・濃くなるのにかかる時間
        constructor(
            readonly period: number,
            private readonly fade: number,
        ) {}

        // 組 phase から見た時計の時刻(0以上period未満)。0で濃くなり始め、period/2で薄れ始める。
        // 組が初めて濃くなり始めるより前は、ずっと霧のままにしておく(-1を返す)
        private local(phase: number, t: number): number {
            const p = this.period
            const raw = t - (phase * p) / 2
            if (raw < 0) return -1
            return raw % p
        }

        // 組 phase の弾 me を、時計の始まりから t フレーム後の状態にする
        apply(me: Bullet, phase: number, t: number) {
            const u = this.local(phase, t)
            const half = this.period / 2

            if (u < 0) {
                me.type = "neutral"
                me.alpha = MIST_ALPHA
            } else if (u < this.fade) {
                me.type = "neutral"
                me.alpha = MIST_ALPHA + (1 - MIST_ALPHA) * (u / this.fade)
            } else if (u < half) {
                me.type = "enemy"
                me.alpha = 1
            } else if (u < half + this.fade) {
                me.type = "neutral"
                me.alpha = 1 - (1 - MIST_ALPHA) * ((u - half) / this.fade)
            } else {
                me.type = "neutral"
                me.alpha = MIST_ALPHA
            }
        }

        // 弾が生きている間、毎フレーム時計に合わせる。start は弾が現れた時点の時計の時刻
        *follow(me: Bullet, phase: number, start: number) {
            for (let t = start; me.life > 0; t++) {
                this.apply(me, phase, t)
                yield
            }
        }
    }

    export type Shuriken = {
        // 飛んでいる時間(霧)と、刺さってから弾けるまでの時間(実体)
        flight: number
        stuck: number
        // 弾けたときの輪の弾の数と速さ
        burstCount: number
        burstSpeed: number
        color: Color
    }

    // start から target へ霧の手裏剣を投げる。刺さると実体になり、少しして輪になって弾ける
    export function shuriken<Parent extends Actor>(
        r: Remodel<Parent>,
        game: Game,
        start: Vec,
        target: Vec,
        config: Shuriken,
    ) {
        return r
            .format("diamond")
            .color(config.color)
            .p(start.clone())
            .speed(0)
            .g(function* (me) {
                // 弾の向きは進む向きでもあるので、回して見せるために位置は直接動かす
                for (let f = 1; f <= config.flight; f++) {
                    me.p = start.add(target.sub(start).scale(Ease.Out(f / config.flight)))
                    me.radian += T / 20
                    yield
                }

                me.type = "enemy"
                me.alpha = 1
                yield* Behavior.rotating(me, T / 40, config.stuck)

                yield* remodel(this)
                    .format("small-ball")
                    .color(config.color)
                    .p(me.p.clone())
                    .radian(me.radian)
                    .speed(config.burstSpeed)
                    .ex(config.burstCount)
                    .appear(10)
                    .fire(game.bullets)

                me.life = 0
            })
    }
}
