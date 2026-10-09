import { Stage } from "../Stage"

// 地図のノードがステージのファイルを見つけられなかったときの代わり。開発中にだけ見る画面なので、文字で知らせる
export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["未実装"])
    }
}
