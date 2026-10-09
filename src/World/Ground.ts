import { T } from "../T"
import { seededRandom } from "../utils/Functions/seededRandom"

// 戦闘画面のキャンバスに敷く地面の模様。虫の目の高さから見下ろした地面を、細い線だけで描く。
// 模様は縦にくり返しながらゆっくり下へ流れ、自機が前へ飛び続けているように見せる。
// 弾と見間違えないよう、点や小さな丸は使わず、大きな形の線だけをごく薄く描く(見た目と当たり判定を乖離させない)
export abstract class Ground {
    // 模様の線。初めて描くときに一度だけ作る
    private path?: Path2D

    constructor(
        // 模様1枚の高さ(px)。幅はキャンバスの幅。形はこの高さの中に収め、縦につなげても継ぎ目が出ないようにする
        protected readonly tileHeight: number,
        // 下へ流れる速さ(px/フレーム)
        private readonly speed: number,
        private readonly color: string,
    ) {}

    draw(ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) {
        this.path ??= this.trace(new Path2D(), seededRandom(this.tileHeight), width)

        ctx.save()
        ctx.globalCompositeOperation = "source-over"
        ctx.strokeStyle = this.color
        ctx.lineWidth = 1.5
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        const offset = (frame * this.speed) % this.tileHeight
        for (let y = offset - this.tileHeight; y < height; y += this.tileHeight) {
            ctx.translate(0, y)
            ctx.stroke(this.path)
            ctx.translate(0, -y)
        }

        ctx.restore()
    }

    // 模様1枚ぶんの線を path に描き足す。random は模様ごとに決まった乱数なので、毎回同じ模様になる
    protected abstract trace(path: Path2D, random: () => number, width: number): Path2D
}

// 蜂の巣の六角形の部屋。r は部屋の半径。縦は3rごとにくり返すので、模様の高さは3rの倍数にする
export class Honeycomb extends Ground {
    constructor(
        private readonly r: number,
        speed: number,
        color: string,
    ) {
        super(r * 3 * Math.round(480 / (r * 3)), speed, color)
    }

    protected trace(path: Path2D, _random: () => number, width: number) {
        const w = Math.sqrt(3) * this.r

        for (let row = 0; row * this.r * 1.5 < this.tileHeight; row++) {
            for (let x = (row % 2) * (w / 2) - w; x < width + w; x += w) {
                const y = row * this.r * 1.5

                for (let k = 0; k <= 6; k++) {
                    const p = {
                        x: x + this.r * Math.cos(T / 12 + (T * k) / 6),
                        y: y + this.r * Math.sin(T / 12 + (T * k) / 6),
                    }
                    if (k === 0) path.moveTo(p.x, p.y)
                    else path.lineTo(p.x, p.y)
                }
            }
        }

        return path
    }
}

// 霜の結晶。六本の腕に、小さな枝が二対ずつ生える
export class Frost extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let i = 0; i < 5; i++) {
            const size = 40 + random() * 50
            const cx = random() * width
            const cy = size + random() * (this.tileHeight - size * 2)
            const tilt = random() * T

            for (let k = 0; k < 6; k++) {
                const angle = tilt + (T * k) / 6
                path.moveTo(cx, cy)
                path.lineTo(cx + size * Math.cos(angle), cy + size * Math.sin(angle))

                for (const at of [0.45, 0.7]) {
                    const bx = cx + size * at * Math.cos(angle)
                    const by = cy + size * at * Math.sin(angle)
                    const twig = size * (0.9 - at) * 0.6

                    for (const side of [-1, 1]) {
                        path.moveTo(bx, by)
                        path.lineTo(
                            bx + twig * Math.cos(angle + (side * T) / 6),
                            by + twig * Math.sin(angle + (side * T) / 6),
                        )
                    }
                }
            }
        }

        return path
    }
}

// 草をなぎ倒していく風の筋。左下から右上へ流れ、先が小さく巻く
export class Gust extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let i = 0; i < 9; i++) {
            const x = -120 + random() * width
            const y = 120 + random() * (this.tileHeight - 160)
            const length = 160 + random() * 160

            path.moveTo(x, y)
            path.bezierCurveTo(x + length * 0.3, y + 20, x + length * 0.6, y - 60, x + length, y - 70)
            // 先の巻き
            path.arc(x + length, y - 82, 12, T / 4, T / 4 - T * 0.7, true)
        }

        return path
    }
}

// 草の間に張られた蜘蛛の巣。放射状の縦糸に、内へたわんだ横糸が何重にも渡る
export class Web extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (const side of [0.25, 0.75]) {
            const radius = 120 + random() * 50
            const cx = width * side + (random() - 0.5) * 80
            const cy = radius + random() * (this.tileHeight - radius * 2)
            const spokes = Array.from({ length: 12 }, (_, k) => (T * k) / 12 + (random() - 0.5) * 0.15)

            for (const angle of spokes) {
                path.moveTo(cx, cy)
                path.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
            }

            for (let ring = 1; ring <= 6; ring++) {
                const r = (radius * ring) / 7
                spokes.forEach((angle, k) => {
                    const next = spokes[(k + 1) % spokes.length]!
                    const from = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
                    const to = { x: cx + r * Math.cos(next), y: cy + r * Math.sin(next) }
                    // 横糸は真ん中が少し内側へたわむ
                    const mid = (angle + (next < angle ? next + T : next)) / 2
                    const sag = r * 0.9

                    if (k === 0) path.moveTo(from.x, from.y)
                    path.quadraticCurveTo(cx + sag * Math.cos(mid), cy + sag * Math.sin(mid), to.x, to.y)
                })
            }
        }

        return path
    }
}

// 沢を流れる霧のすじ。横に長く、ゆるく波打つ
export class Mist extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let i = 0; i < 14; i++) {
            const x = -100 + random() * width
            const y = 20 + random() * (this.tileHeight - 40)
            const length = 160 + random() * 260
            const phase = random() * T

            path.moveTo(x, y + 8 * Math.sin(phase))
            for (let d = 10; d <= length; d += 10) {
                path.lineTo(x + d, y + 8 * Math.sin(phase + d / 40))
            }
        }

        return path
    }
}

// 風が砂に刻んだ波紋。画面の幅いっぱいに、不揃いに波打つ線が並ぶ
export class Ripple extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let y = 16; y < this.tileHeight - 16; y += 26 + random() * 14) {
            const phase = random() * T
            const amplitude = 4 + random() * 6

            path.moveTo(0, y + amplitude * Math.sin(phase))
            for (let x = 8; x <= width; x += 8) {
                path.lineTo(
                    x,
                    y + amplitude * Math.sin(phase + x / 50) + amplitude * 0.4 * Math.sin(phase * 2 + x / 17),
                )
            }
        }

        return path
    }
}

// 日に焼けた石垣。高さのそろった石の段が、継ぎ目をずらして積まれている
export class Stones extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        const rowHeight = 64
        const gap = 4
        const corner = 10

        for (let y = 0; y < this.tileHeight; y += rowHeight) {
            for (let x = -random() * 120; x < width;) {
                const w = 90 + random() * 70
                const left = x + gap
                const right = x + w - gap
                const top = y + gap
                const bottom = y + rowHeight - gap

                path.moveTo(left + corner, top)
                path.lineTo(right - corner, top)
                path.quadraticCurveTo(right, top, right, top + corner)
                path.lineTo(right, bottom - corner)
                path.quadraticCurveTo(right, bottom, right - corner, bottom)
                path.lineTo(left + corner, bottom)
                path.quadraticCurveTo(left, bottom, left, bottom - corner)
                path.lineTo(left, top + corner)
                path.quadraticCurveTo(left, top, left + corner, top)

                x += w
            }
        }

        return path
    }
}

// 古い木の樹皮。縦に長い溝が、うねりながら並ぶ。うねりは模様の高さで一周するので、縦につなげても途切れない
export class Bark extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let x = 10; x < width; x += 22 + random() * 24) {
            const phase = random() * T
            const amplitude = 4 + random() * 8
            const waves = 1 + Math.floor(random() * 3)

            path.moveTo(x + amplitude * Math.sin(phase), 0)
            for (let y = 8; y <= this.tileHeight; y += 8) {
                path.lineTo(x + amplitude * Math.sin(phase + (T * waves * y) / this.tileHeight), y)
            }
        }

        return path
    }
}

// 河原を流れる水。短い波のしるしが、横に流れるように何列も並ぶ
export class Stream extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let y = 20; y < this.tileHeight - 20; y += 34) {
            for (let x = -random() * 60; x < width; x += 70 + random() * 90) {
                const length = 40 + random() * 50

                path.moveTo(x, y)
                for (let d = 6; d <= length; d += 6) {
                    path.lineTo(x + d, y - 5 * Math.sin((T * d) / length))
                }
            }
        }

        return path
    }
}

// 夜の草むらを上から見た、細長い葉。だいたい同じ向きに寝ている
export class Grass extends Ground {
    protected trace(path: Path2D, random: () => number, width: number) {
        for (let i = 0; i < 22; i++) {
            const length = 120 + random() * 140
            const angle = -T / 6 + (random() - 0.5) * 0.8
            const dx = length * Math.cos(angle)
            const dy = length * Math.sin(angle)
            const x = random() * width - dx / 2
            const y = Math.max(-dy, 0) + random() * (this.tileHeight - Math.abs(dy))
            // 葉の幅は、付け根と先は細く、真ん中が広い
            const nx = -Math.sin(angle) * 7
            const ny = Math.cos(angle) * 7

            path.moveTo(x, y)
            path.quadraticCurveTo(x + dx / 2 + nx, y + dy / 2 + ny, x + dx, y + dy)
            path.quadraticCurveTo(x + dx / 2 - nx, y + dy / 2 - ny, x, y)
        }

        return path
    }
}
