export class Dom {
    static container: HTMLElement

    static init() {
        this.container = document.getElementById("container")!
    }
}
