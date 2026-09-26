import { DigitalInput } from "@ipota/input"

export const input = new DigitalInput({
    up: ["ArrowUp", "KeyW", "gamepad-axis-1-negative"],
    down: ["ArrowDown", "KeyS", "gamepad-axis-1-positive"],
    left: ["ArrowLeft", "KeyA", "gamepad-axis-0-negative"],
    right: ["ArrowRight", "KeyD", "gamepad-axis-0-positive"],
    jump: ["ArrowUp", "KeyW", "Space", "gamepad-button-0"],
    fire: ["KeyX", "gamepad-button-5", "gamepad-button-7"],
    slash: ["KeyZ", "gamepad-button-2"],

    ok: ["Enter", "KeyZ", "Space", "gamepad-button-0"],
    cancel: ["KeyX", "Escape", "Backspace", "gamepad-button-1"],
    pause: ["Escape", "KeyP", "gamepad-button-9"],
})
