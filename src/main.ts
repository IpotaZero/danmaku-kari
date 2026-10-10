import { App } from "./App.js"

document.addEventListener("DOMContentLoaded", async () => {
    App.looper.start()
    App.sc.goto(async () => await import("./Scene/ScenePreTitle.js").then(({ ScenePreTitle }) => new ScenePreTitle()))
})

App.looper.addHandler((timeScale) => {
    App.fpsMeter.countUpdate()
    App.sc.update()
    App.input.update()
    App.analogInput.update()
})

App.looper.addRenderHandler(() => {
    App.fpsMeter.countFrame()
    if (!App.drawLimiter.shouldDraw()) return

    App.sc.draw()
    App.fpsMeter.countDraw()
})

window.addEventListener("keydown", (e) => {
    if (["Tab", "Enter"].includes(e.code)) e.preventDefault()
})

window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
})

;(window as any).App = App
