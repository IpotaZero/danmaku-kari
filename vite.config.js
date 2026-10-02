import { defineConfig } from "vite"

export default defineConfig({
    base: "./",
    plugins: [],
    build: {
        target: ["esnext"],
        rollupOptions: {
            input: "src/main.ts",
            output: {
                entryFileNames: "main.js",
                dir: "dist/module",
                // ファイル分割時は名前衝突を防ぐため、元の設定にハッシュや識別子を追加することを推奨します
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`,
            },
        },

        sourcemap: true,
    },
})
