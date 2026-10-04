import { Vec, vec } from "@ipota/vec"
import { Ease, GenUtils } from "@ipota/functions"
import { Actor } from "../../Game/Actor/Actor"
import { Bullet } from "../../Game/Actor/Bullet"
import { Game } from "../../Game/Game"
import { Behavior, Remodel, remodel } from "../../Game/Remodel"
import { T } from "../../T"

// 霧隠道場の「霧」。
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

    export type Field = {
        // 石の間隔と、石を敷く範囲の上端(画面の高さに対する割合)
        spacing: number
        top: number
        // 石が霧の姿で現れてから入れ替わりが始まるまで・入れ替わりを続ける時間・消えるまで
        intro: number
        active: number
        fade: number
    }

    // 画面の下の方に、大きな石を市松模様に敷く。(列+行)の偶奇で組を分け、時計に合わせて交互に霧にする。
    // 時計は入れ替わりが始まる時点を0として数える。offset は並びのずれ(0以上spacing未満)
    export function stones<Parent extends Actor>(
        r: Remodel<Parent>,
        game: Game,
        clock: Clock,
        field: Field,
        offset: Vec,
        colors: readonly Color[],
    ) {
        const origin = vec(offset.x, game.HEIGHT * field.top + offset.y)
        const columns = Math.ceil((game.WIDTH - origin.x) / field.spacing)
        const rows = Math.ceil((game.HEIGHT - origin.y) / field.spacing)
        const phaseOf = (i: number) => ((i % columns) + Math.floor(i / columns)) % 2

        return r
            .format("big-ball")
            .speed(0)
            .type("neutral")
            .alpha(MIST_ALPHA)
            .duplicate(columns * rows, (b, i) => {
                b.p = origin.add(vec(i % columns, Math.floor(i / columns)).scale(field.spacing))
                b.color = colors[phaseOf(i)]
                return b
            })
            .g(function* (me, i) {
                yield* GenUtils.all({
                    appear: Behavior.appear(me, field.intro),
                    clock: (function* () {
                        for (let t = -field.intro; t < field.active; t++) {
                            clock.apply(me, phaseOf(i), t)
                            yield
                        }
                    })(),
                })

                yield* Behavior.fadeout(me, field.fade)
            })
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
            .type("neutral")
            .alpha(0.25)
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
