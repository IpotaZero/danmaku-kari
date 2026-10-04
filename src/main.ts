import { App } from "./App.js"

document.addEventListener("DOMContentLoaded", async () => {
    App.looper.start()
    App.sc.goto(async () => await import("./Scene/SceneTitle.js").then(({ SceneTitle }) => new SceneTitle()))
})

App.looper.addHandler((timeScale) => {
    App.sc.update()
    App.input.update()
})

App.looper.addRenderHandler(() => {
    App.sc.draw()
})

window.addEventListener("keydown", (e) => {
    if (["Tab", "Enter"].includes(e.code)) e.preventDefault()
})

window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
})
