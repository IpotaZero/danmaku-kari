import { Ease } from "@ipota/functions"
import { Vec, vec } from "@ipota/vec"
import { Bullet } from "./Actor/Bullet"
import { T } from "../T"
import { GenUtils } from "@ipota/functions"
import type { NumberKeys } from "@ipota/my-utils"
import { Actor } from "./Actor/Actor"

export function remodel<Parent extends Actor>(e: Parent) {
    return new Remodel([new Bullet(e.game)], e)
}

// Bullet のうち、値として書き換えられるプロパティ(メソッドと readonly を除く)
type BulletProps = {
    [K in keyof Bullet]-?: Bullet[K] extends Function
        ? never
        : (<T>() => T extends { [Q in K]: Bullet[K] } ? 1 : 2) extends <T>() => T extends {
                -readonly [Q in K]: Bullet[K]
            }
                ? 1
                : 2
          ? K
          : never
}[keyof Bullet]

// remodel(this).r(12).speed(3) のように Bullet のプロパティを一括で書き換えるメソッド群
type BulletSetters<Self> = {
    [K in BulletProps]: (value: Bullet[K]) => Self
}

namespace Format {
    export const r = {
        "donut": 12,
        "big-ball": 24,
        "small-ball": 4,
        "arrow": 24,
        "line": 24,
        "wedge": 16,
        "diamond": 16,
    } as const

    export const collision = {
        "donut": "circle",
        "big-ball": "circle",
        "small-ball": "circle",
        "arrow": "arrow",
        "line": "line",
        "wedge": "wedge",
        "diamond": "diamond",
    } as const

    export const appearance = {
        "donut": "donut",
        "big-ball": "ball",
        "small-ball": "ball",
        "arrow": "arrow",
        "line": "line",
        "wedge": "wedge",
        "diamond": "diamond",
    } as const
}

export namespace Behavior {
    // 数フレームの間追尾する
    export function* homing(me: Bullet, p: Vec, frame: number) {
        for (let i = 0; i < frame; i++) {
            me.radian = p.sub(me.p).radian()
            yield
        }
    }

    // 数フレームかけて現れる
    export function* appear(me: Bullet, frame: number = 30) {
        const r = me.r
        me.r = 0
        yield* ease(me, "r", r, frame, Ease.Out)
    }

    // 数フレームかけて停止し、数フレーム何もせず、数フレームかけて加速する
    export function* reaccel(
        me: Bullet,
        stopFrame: number,
        waitFrame: number,
        accelFrame: number,
        finalSpeed?: number,
    ) {
        const initialSpeed = me.speed
        yield* stop(me, stopFrame)
        yield* Array(waitFrame)
        yield* accel(me, accelFrame, finalSpeed ?? initialSpeed)
    }

    // 数フレームかけて停止する
    export function* stop(me: Bullet, stopFrame: number) {
        yield* accel(me, stopFrame, 0)
    }

    // 数フレームかけて加速する
    export function* accel(me: Bullet, frame: number, finalSpeed: number) {
        yield* ease(me, "speed", finalSpeed, frame, Ease.Linear)
    }

    export function* rotating(me: Bullet, angularSpeed: number) {
        while (me.life > 0) {
            me.radian += angularSpeed
            yield
        }
    }

    // 数フレームかけて消える。始まった時点で当たり判定は消える
    export function* fadeout(me: Bullet, frame: number) {
        me.type = "neutral"
        yield* ease(me, "alpha", 0, frame, Ease.Linear)
        me.life = 0
    }

    // 数フレームかけて値を変化させる
    export function* ease(
        me: Bullet,
        key: NumberKeys<Bullet>,
        target: number,
        frame: number,
        easing: (t: number) => number = Ease.Out,
        floor?: number,
    ) {
        const start = me[key]

        if (floor) {
            for (let i = 1; i < frame + 1; i++) {
                ;(me as any)[key] = Math.floor(((target - start) * easing(i / frame) + start) * floor) / floor
                yield
            }
        } else {
            for (let i = 1; i < frame + 1; i++) {
                ;(me as any)[key] = (target - start) * easing(i / frame) + start
                yield
            }
        }
    }

    // target へ向けて投げる。frame フレームかけて等しく減速し、ちょうど target で止まる
    export function* throwTo(me: Bullet, target: Vec, frame: number) {
        const diff = target.sub(me.p)
        me.radian = diff.radian()
        me.speed = (diff.magnitude() * 2) / frame
        yield* Behavior.stop(me, frame)
    }
}

// BulletSetters は constructor が返す Proxy によって実装される
export interface Remodel<Parent extends Actor> extends BulletSetters<Remodel<Parent>> {}

export class Remodel<Parent extends Actor> {
    private readonly indices: number[][]

    constructor(
        private bullets: Bullet[],
        private readonly e: Parent,
    ) {
        this.indices = bullets.map(() => [])

        return new Proxy(this, {
            get(target, key, receiver: Remodel<Parent>) {
                if (key in target) return Reflect.get(target, key, receiver)

                return (value: Bullet[BulletProps]) => receiver.set(key as BulletProps, value)
            },
        })
    }

    // 発射
    *fire(bullets: Bullet[]) {
        this.bullets.forEach((b) => {
            b.init()
        })

        let frame = 0

        this.bullets.sort((a, b) => a.delay - b.delay)

        for (const b of this.bullets) {
            while (b.delay > frame) {
                frame++
                yield
            }

            bullets.push(b)
        }
    }

    format(type: keyof typeof Format.r) {
        return this.appearance(Format.appearance[type]).collision(Format.collision[type]).r(Format.r[type])
    }

    // 出現を遅らせる
    delayByIndex(scalar: number = 1) {
        this.forEach((b, index) => {
            b.delay = index * scalar
        })
        return this
    }

    // 色を変える
    colorful(seed: number) {
        return this.set("color", `hsl(${seed % 360},100%,50%)`)
    }

    // 弾の向きを指定した座標に向ける
    aim(target: Vec) {
        return this.forEach((b) => {
            b.radian = target.sub(b.p).radian()
        })
    }

    // min から max の間の速度の弾を num 発生成する
    sim(num: number, min: number, max: number) {
        return this.duplicate(num, (b, i) => {
            b.speed = (max - min) * (i / (num - 1)) + min
            return b
        })
    }

    // ばらつきを持たせて num 発複製する。数値プロパティは [min, max] の範囲でランダムに割り振り、
    // p だけは特別扱いして、その場所を中心に半径 p 以内の円の中へ一様分布でランダムに散らす
    // (単純に半径だけ乱数にすると中心付近に偏るため、sqrtで面積が一様になるよう補正している)
    scatter(ranges: Partial<Record<NumberKeys<Bullet>, [number, number]>> & { p?: number }) {
        return this.forEach((b) => {
            for (const key in ranges) {
                if (key === "p") continue

                const range = ranges[key as NumberKeys<Bullet>]
                if (!range) continue

                const [min, max] = range
                ;(b[key as NumberKeys<Bullet>] as number) = min + Math.random() * (max - min)
            }

            if (ranges.p !== undefined) {
                const radius = ranges.p * Math.sqrt(Math.random())
                const angle = Math.random() * T
                b.p = b.p.add(vec.arg(angle).scale(radius))
            }
        })
    }

    // n-way 弾を生成する。angle は弾の間の角度
    nway(num: number, angle: number) {
        return this.duplicate(num, (b, i) => {
            b.radian += angle * (i - (num - 1) / 2)
            b.radian = Math.floor((b.radian % T) * 128) / 128
            return b
        })
    }

    // shift だけずらした弾を生成する
    shift(num: number, shift: number) {
        return this.duplicate(num, (b, i) => {
            const shiftVec = vec.arg(b.radian + T / 4).scale(shift * (i - (num - 1) / 2))
            b.p = b.p.add(shiftVec)
            return b
        })
    }

    // 弾を複製する。map で複製した弾のプロパティを変更できる
    duplicate(num: number, map?: (me: Bullet, index: number, ...parentIndices: number[]) => Bullet) {
        if (map) {
            const result: Bullet[] = []
            const resultIndices: number[][] = []

            const length = this.bullets.length

            for (let i = 0; i < length; i++) {
                const bullet = this.bullets[i]

                for (let j = 0; j < num; j++) {
                    result.push(map(bullet.clone(), j, ...this.indices[i]))
                    resultIndices.push([...this.indices[i], j])
                }
            }

            this.bullets = result
            this.indices.splice(0, this.indices.length, ...resultIndices)

            return this
        } else {
            const result: Bullet[] = []
            const resultIndices: number[][] = []

            this.bullets.forEach((bullet, i) => {
                for (let j = 0; j < num; j++) {
                    result.push(bullet.clone())
                    resultIndices.push([...this.indices[i], j])
                }
            })

            this.bullets = result
            this.indices.splice(0, this.indices.length, ...resultIndices)

            return this
        }
    }

    // 弾を円形に配置する。direction は弾の向きの方向を指定する
    circle(distance: number, radius: number, { direction = "none" }: { direction?: "inner" | "outer" | "none" } = {}) {
        const num = Math.ceil((T * radius) / distance)
        return this.duplicate(num, (b, i) => {
            const angle = (T / num) * i
            b.p = b.p.add(vec.arg(angle).scale(radius))

            if (direction === "inner") {
                b.radian = T * (i / num + 0.5)
            } else if (direction === "outer") {
                b.radian = T * (i / num)
            }

            return b
        })
    }

    // 弾を中心から放射状に配置する
    ex(num: number) {
        return this.duplicate(num, (b, i) => {
            b.radian = b.radian + Math.PI * 2 * (i / num)
            b.radian = Math.floor((b.radian % T) * 128) / 128
            return b
        })
    }

    // 弾を壁に当たったら跳ね返るようにする
    bounce(count: number, width: number, height: number) {
        let c = count

        return this.g(function* (b) {
            while (c > 0) {
                yield

                if (b.p.x < -width / 2) {
                    b.p.x = -width / 2
                    b.radian = Math.PI - b.radian
                    c--
                } else if (b.p.x > width / 2) {
                    b.p.x = width / 2
                    b.radian = Math.PI - b.radian
                    c--
                }
            }
        })
    }

    // ビームを生成する。length はビームの長さ
    beam(length: number) {
        const e = this.e

        return this.length(length)
            .speed(0)
            .r(12)
            .appearance("beam")
            .collision("rect")
            .isScorable(false)
            .g(function* (me) {
                let i = 0

                while (1) {
                    i++
                    me.alpha = 0.8 * (Math.sin(i / 10) + 1) + 0.8

                    me.p = e.p

                    if (e.life <= 0) {
                        break
                    }

                    yield
                }

                yield* Behavior.fadeout(me, 15)
            })
    }

    // レーザーを生成する。waitFrame は予告があってからレーザーが出るまでの時間、existsFrame はレーザーが存在する時間、length はレーザーの長さ
    laser(waitFrame: number, existsFrame: number, length: number) {
        return this.length(length)
            .speed(0)
            .type("neutral")
            .alpha(0)
            .appearance("laser")
            .collision("rect")
            .r(2)
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0.1, 30, Ease.Out)
                yield* Array(waitFrame)
                me.type = "enemy"
                yield* GenUtils.parallel(
                    Behavior.ease(me, "r", 8, 30, Ease.Out),
                    Behavior.ease(me, "alpha", 1, 30, Ease.Out),
                    //
                )
                yield* Array(existsFrame)
                yield* Behavior.fadeout(me, 15)
            })
            .g(function* (me) {
                while (this.life > 0) yield
                yield* Behavior.fadeout(me, 30)
            })
    }

    // 指定したフレーム後に消える
    delete(frame: number = 0) {
        return this.g(function* (b) {
            for (let i = 0; i < frame; i++) yield
            b.life = 0
        })
    }

    // 挙動を追加する。g の this は Remodel を呼び出した Actor になる
    g(
        g: (this: Parent, me: Bullet, index: number, ...generationIndices: number[]) => Generator,
        config: { loop?: number; margin?: number } = {},
    ) {
        const e = this.e
        const indices = this.indices

        this.bullets.forEach((b, index) => {
            b.addScriptBook(
                function* (me: Bullet) {
                    yield* g.call(e, me, index, ...indices[index])
                } as () => Generator<void, void, void>,
                config,
            )
        })

        return this
    }

    // 弾に対して処理を行う。
    forEach(handler: (me: Bullet, index: number) => void) {
        this.bullets.forEach(handler)
        return this
    }

    // 弾のプロパティを一括で変更する
    set<K extends BulletProps>(key: K, value: Bullet[K]) {
        this.bullets.forEach((b) => {
            b[key] = value
        })

        return this
    }
}
