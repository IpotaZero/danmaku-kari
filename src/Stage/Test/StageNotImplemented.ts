import { Stage } from "../Stage"

export default class extends Stage {
    *G() {
        yield* this.game.textBox.say(["未実装"])
    }
}
