/**
 * assets に置いたSVGファイル。作った時点でfetchで読み込みを始め、ルートの<svg>の内側を content に入れる。
 * 外側の<svg>(viewBox・class)は使う側で書くので、ファイルのルートの属性はエディタで見るためだけのもの。
 * content を使う前に SvgFile.loadAll() を待っておくこと。
 */
export class SvgFile {
    private static readonly all: SvgFile[] = []

    content = ""
    private readonly loading: Promise<void>

    constructor(path: string) {
        this.loading = fetch(path)
            .then((response) => {
                if (!response.ok) throw new Error(`SVGを読み込めません: ${path} (${response.status})`)
                return response.text()
            })
            .then((text) => {
                this.content = new DOMParser().parseFromString(text, "text/html").querySelector("svg")!.innerHTML
            })
        SvgFile.all.push(this)
    }

    // これまでに作られたSVGファイルをすべて読み込み終えるまで待つ
    static async loadAll(): Promise<void> {
        await Promise.all(SvgFile.all.map((file) => file.loading))
    }
}
