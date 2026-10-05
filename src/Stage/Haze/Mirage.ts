import { Vec, vec } from "@ipota/vec"
import { Enemy } from "../../Game/Actor/Enemy"
import { T } from "../../T"
import { Behavior, remodel } from "../../Game/Remodel"
import { Ctx } from "../../utils/Functions/Ctx"
import { MathEx } from "../../utils/Functions/MathEx"

// 陽炎道場の「蜃気楼」。
// 鏡の線(center を通る angle 向きの線)を挟んで、敵の弾はすべて鏡写しの双子を持つ(Remodel.mirror)。
// 双子を撃つのは鏡の向こうに映った敵の幻なので、幻と鏡の線を描いて、どこから弾が来るかを分かるようにする。
// 幻は描かれるだけで、撃っても当たらない。
// 鏡を取り去ると、鏡の線も幻も、鏡に映っていた弾も、すべて薄れて消える
export namespace Mirage {
    // 薄れて現れる・消えるのにかかる時間
    const FADE_FRAMES = 24

    export class Mirror {
        private active = true

        constructor(
            readonly center: Vec,
            // 鏡を回すときに書き換える。映っている弾や幻も一緒に動く
            public angle: number,
        ) {}

        isActive() {
            return this.active
        }

        // 鏡を取り去る
        remove() {
            this.active = false
        }
    }

    // 画面の真ん中を横に通る鏡
    export function horizontal({ WIDTH, HEIGHT }: { WIDTH: number; HEIGHT: number }) {
        return new Mirror(vec(WIDTH / 2, HEIGHT / 2), 0)
    }

    // 画面の真ん中を縦に通る鏡
    export function vertical({ WIDTH, HEIGHT }: { WIDTH: number; HEIGHT: number }) {
        return new Mirror(vec(WIDTH / 2, HEIGHT / 2), T / 4)
    }

    // 画面を縦と横に仕切る二枚の鏡
    export function cross(dims: { WIDTH: number; HEIGHT: number }) {
        return [horizontal(dims), vertical(dims)]
    }

    function color(alpha: number) {
        return `rgba(255, 210, 160, ${alpha})`
    }

    // 鏡の線を、center から両側へ length ずつ伸ばして描く。外側にぼんやりした光、内側に白っぽい芯を重ねる。
    // brightness は明るさ(0〜1)、width は芯の太さ
    function stroke(
        ctx: CanvasRenderingContext2D,
        { center, angle }: Mirror,
        length: number,
        brightness: number,
        width: number,
    ) {
        const d = vec.arg(angle).scale(length)
        const line = () => {
            ctx.beginPath()
            ctx.moveTo(center.x - d.x, center.y - d.y)
            ctx.lineTo(center.x + d.x, center.y + d.y)
            ctx.stroke()
        }

        ctx.lineCap = "round"

        ctx.strokeStyle = color(0.25 * brightness)
        ctx.lineWidth = width * 4
        line()

        ctx.shadowBlur = width * 4
        ctx.shadowColor = color(brightness)
        ctx.strokeStyle = `rgba(255, 245, 225, ${brightness})`
        ctx.lineWidth = width
        line()
    }

    // 光の粒を描く。中心が白く、まわりがぼんやり光る
    function spark(ctx: CanvasRenderingContext2D, p: Vec, r: number, alpha: number) {
        Ctx.arc(ctx, p, r * 2.5, color(0.25 * alpha))
        Ctx.arc(ctx, p, r, `rgba(255, 250, 235, ${alpha})`)
    }

    // p から radian の向きへ、きらきらした粒(当たり判定なし)を飛ばす。粒は薄れて消える
    function* sparkle(e: Enemy, p: Vec, radian: number, speed: number) {
        yield* remodel(e)
            .format("small-ball")
            .r(3)
            .type("effect")
            .isScorable(false)
            .color("#fff0d8")
            .p(p.clone())
            .radian(radian)
            .speed(speed)
            .g(function* (me) {
                yield* Behavior.ease(me, "alpha", 0, 30 + 20 * this.random())
                me.life = 0
            })
            .fire(e.game.bullets)
    }

    // 鏡を引く。
    // 中心にまぶしい光が灯り、そこから両側へ、光の粒を散らしながら frames かけて一定の速さで画面の端まで線が伸びる。
    // 引き終わった瞬間、線全体がまぶしく光って画面が揺れ、線に沿って光の粒が弾ける。そのとき飛んでいる弾もすべて鏡に映る。
    // その後も線ははっきり残り、陽炎のように明るさが揺らめき、ときどき光が線の上を走る。
    // 鏡が取り去られると、線は薄れて消える
    export function* draw(e: Enemy, mirror: Mirror, frames: number) {
        const reach = e.game.WIDTH + e.game.HEIGHT
        const glowFrames = 40

        // 画面の外まで伸ばしても見えないので、伸びる演出は中心から一番遠い画面の角までにする
        const { WIDTH, HEIGHT } = e.game
        const corners = [vec(0, 0), vec(WIDTH, 0), vec(0, HEIGHT), vec(WIDTH, HEIGHT)]
        const far = Math.max(...corners.map((c) => c.sub(mirror.center).magnitude()))

        let fade = 1

        for (let f = 0; e.life > 0 && fade > 0; f++) {
            if (!mirror.isActive()) fade -= 1 / FADE_FRAMES

            const t = frames > 0 ? Math.min(1, f / frames) : 1
            const length = t < 1 ? far * t : reach
            const glow = f < frames ? 0 : Math.max(0, 1 - (f - frames) / glowFrames)
            // 鏡は回されることがあるので、向きは毎フレーム見直す
            const along = vec.arg(mirror.angle)
            const across = mirror.angle + T / 4
            const tips = [-1, 1].map((side) => mirror.center.add(along.scale(side * length)))
            const shimmer = 0.85 + 0.15 * Math.sin(f / 7)
            const alpha = fade

            // 線の上を走る光。引き終わった後、少し間を空けながら両端へ流れていく
            const glint = t < 1 ? undefined : ((f - frames) % 150) / 60

            if (t < 1 && f % 2 === 0) {
                for (const [k, tip] of tips.entries()) {
                    yield* sparkle(e, tip, across + (k * T) / 2 + (e.random() - 0.5) * 1.2, 0.5 + e.random())
                }
            }

            // 引き終わった瞬間。最初から掛かっている鏡(frames が0)では何もしない
            if (frames > 0 && f === frames) {
                e.game.camera.shake(6, 16)

                // すでに飛んでいる弾も、いま現れた鏡に映る。映った弾は薄い姿から濃くなっていく
                const bullets = e.game.bullets
                for (const b of bullets.filter((b) => b.type === "enemy")) bullets.push(b.reflectNow(mirror))

                for (let k = 0; k < 40; k++) {
                    const p = mirror.center.add(along.scale((e.random() * 2 - 1) * far))
                    yield* sparkle(e, p, across + (e.random() < 0.5 ? 0 : T / 2), 1 + 2 * e.random())
                }
            }

            e.game.drawInWorld((ctx) => {
                stroke(ctx, mirror, length, Math.min(1, (0.55 * shimmer + glow) * alpha), 2.5 + 8 * glow)

                if (t < 1) {
                    // 中心の光と、伸びていく線の先の光
                    spark(ctx, mirror.center, 6 + 2 * Math.sin(f / 3), alpha)
                    for (const tip of tips) spark(ctx, tip, 6, alpha)
                } else if (glint !== undefined && glint < 1) {
                    for (const side of [-1, 1]) {
                        spark(ctx, mirror.center.add(along.scale(side * far * glint)), 3, 0.8 * alpha)
                    }
                }
            })

            yield
        }
    }

    // 鏡に映った e の幻を描く。幻は appear フレーム後(鏡を引き終わったころ)から薄く現れ、
    // 鏡のどれかが取り去られると薄れて消える。
    // 鏡が複数あるときは、鏡に映った幻がさらに別の鏡に映った幻も描く(Remodel.mirror を重ねたときの双子の双子)
    export function* ghosts(e: Enemy, mirrors: readonly Mirror[], appear: number) {
        let alpha = 0

        for (let f = 0; e.life > 0; f++) {
            const active = mirrors.every((m) => m.isActive())

            if (active) {
                if (f >= appear) alpha = Math.min(1, alpha + 1 / FADE_FRAMES)
            } else {
                alpha -= 1 / FADE_FRAMES
                if (alpha <= 0) return
            }

            const points = mirrors
                .reduce((points, m) => [...points, ...points.map((q) => MathEx.reflect(q, m.center, m.angle))], [e.p])
                .slice(1)

            if (alpha > 0) drawImages(e, points, alpha)
            yield
        }
    }

    // e が生きている間ずっと、e の幻を描く。幻の位置は e の位置から places で決める
    export function* images(e: Enemy, places: (p: Vec) => Vec[]) {
        while (e.life > 0) {
            drawImages(e, places(e.p), 1)
            yield
        }
    }

    // e の幻を points に描く
    function drawImages(e: Enemy, points: readonly Vec[], alpha: number) {
        const r = e.r
        const theta = -e.frame / 60
        const c = color(0.35 * alpha)

        e.game.drawInWorld((ctx) => {
            for (const ghost of points) {
                Ctx.arc(ctx, ghost, r * 1.1, c, { lineWidth: 1 })
                Ctx.arc(ctx, ghost, r, c, { lineWidth: 1 })
                Ctx.polygon(ctx, 5, 2, ghost, r * 0.85, c, { theta, lineWidth: 1 })
            }
        })
    }

    // e に鏡を引いて、幻を映す。drawFrames は鏡を引くのにかかる時間
    export function show(e: Enemy, mirrors: readonly Mirror[], drawFrames: number) {
        mirrors.forEach((m) => e.addScript(() => draw(e, m, drawFrames)))
        e.addScript(() => ghosts(e, mirrors, drawFrames))
    }
}
