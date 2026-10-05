const fs = require("node:fs/promises")
const path = require("node:path")

const defaultCanvasPath = path.resolve(__dirname, "../assets/MapData/MapData.canvas")

async function readCanvas(filePath = defaultCanvasPath) {
    const text = await fs.readFile(filePath, "utf8")
    const canvas = JSON.parse(text)

    if (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges)) {
        throw new Error(`${filePath} は nodes と edges を持つ JSON Canvas ではありません`)
    }

    return canvas
}

function findNode(canvas, nodeId) {
    const node = canvas.nodes.find(({ id }) => id === nodeId)
    if (!node) throw new Error(`ノードが見つかりません: ${nodeId}`)
    return node
}

function setNodePosition(canvas, nodeId, x, y) {
    const node = findNode(canvas, nodeId)
    node.x = x
    node.y = y
    return node
}

function moveNode(canvas, nodeId, dx, dy) {
    const node = findNode(canvas, nodeId)
    return setNodePosition(canvas, nodeId, node.x + dx, node.y + dy)
}

function scaleNodes(canvas, scale) {
    for (const node of canvas.nodes) {
        node.x *= scale
        node.y *= scale
    }
    return canvas
}

async function writeCanvas(canvas, filePath = defaultCanvasPath) {
    await fs.writeFile(filePath, `${JSON.stringify(canvas, null, "\t")}\n`, "utf8")
}

function printUsage() {
    console.log(`使い方:
  node scripts/xy.js list [canvas]
  node scripts/xy.js set <node-id> <x> <y> [canvas] [output]
  node scripts/xy.js move <node-id> <dx> <dy> [canvas] [output]
    node scripts/xy.js scale <scale> [canvas] [output]

canvas の既定値: assets/MapData/MapData.canvas
output を省略すると canvas を上書きします。`)
}

function number(value, name) {
    const result = Number(value)
    if (!Number.isFinite(result)) throw new Error(`${name} は数値で指定してください: ${value}`)
    return result
}

async function main(args) {
    const [command, ...values] = args
    if (!command || command === "help" || command === "--help") {
        printUsage()
        return
    }

    if (command === "list") {
        const filePath = values[0] ?? defaultCanvasPath
        const canvas = await readCanvas(filePath)
        for (const node of canvas.nodes) {
            const label = node.text?.split("\n")[0] ?? ""
            console.log(`${node.id}\t(${node.x}, ${node.y})\t${label}`)
        }
        return
    }

    if (command === "scale") {
        const [scaleValue, inputPath = defaultCanvasPath, outputPath = inputPath] = values
        const canvas = await readCanvas(inputPath)
        scaleNodes(canvas, number(scaleValue, "scale"))
        await writeCanvas(canvas, outputPath)
        console.log(`${canvas.nodes.length} 個のノードを ${scaleValue} 倍しました -> ${outputPath}`)
        return
    }

    if (command !== "set" && command !== "move") throw new Error(`不明なコマンドです: ${command}`)
    if (values.length < 3) throw new Error(`${command} には node-id と座標2つが必要です`)

    const [nodeId, first, second, inputPath = defaultCanvasPath, outputPath = inputPath] = values
    const canvas = await readCanvas(inputPath)
    const node =
        command === "set"
            ? setNodePosition(canvas, nodeId, number(first, "x"), number(second, "y"))
            : moveNode(canvas, nodeId, number(first, "dx"), number(second, "dy"))
    await writeCanvas(canvas, outputPath)
    console.log(`${node.id}: (${node.x}, ${node.y}) -> ${outputPath}`)
}

if (require.main === module) {
    main(process.argv.slice(2)).catch((error) => {
        console.error(error.message)
        process.exitCode = 1
    })
}

module.exports = { readCanvas, findNode, setNodePosition, moveNode, scaleNodes, writeCanvas }
