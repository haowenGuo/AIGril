import { resolve } from 'node:path';
import { defineConfig } from 'vite';


// 使用相对 base，避免 GitHub Pages 项目站点因为仓库名不同而出现资源路径错误。
export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            input: {
                main: resolve(process.cwd(), 'index.html'),
                studio: resolve(process.cwd(), 'studio.html')
            }
        }
    },
    server: {
        host: '0.0.0.0',
        port: 5173
    }
});
