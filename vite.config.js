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
                // npmでインストールしたライブラリを別ファイルに切り出す
                manualChunks(id) {
                    if (id.includes("node_modules")) {
                        // Three.js系のモジュールを "three.js" として独立させる
                        if (id.includes("three")) {
                            return "three"
                        }
                        // それ以外のライブラリを "vendor.js" にまとめる
                        return "vendor"
                    }
                },
            },
        },

        sourcemap: true,
    },
})
