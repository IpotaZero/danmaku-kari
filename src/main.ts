import { Dom } from "./Dom.js"
import { looper } from "./looper.js"
import { input } from "./input.js"
import { sc } from "./sc.js"

document.addEventListener("DOMContentLoaded", async () => {
    looper.start()
    sc.goto(async () => await import("./Scene/SceneTitle.js").then(({ SceneTitle }) => new SceneTitle()))
})

looper.addHandler((timeScale) => {
    sc.update()
    input.update()
})

window.addEventListener("keydown", (e) => {
    if (["Tab", "Enter"].includes(e.code)) e.preventDefault()
})

window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
})
