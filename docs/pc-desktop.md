# AIGril PC 桌面版

AIGril 的 PC 桌面版使用 Electron 包装现有 Vite 前端，同一套 `dist` 产物会被桌面窗口加载。

## 开发启动

```bash
pnpm install
pnpm desktop:dev
```

`desktop:dev` 会同时启动 Vite 开发服务器和 Electron 窗口。

## 使用已构建产物启动

```bash
pnpm desktop:start
```

这个命令会先执行 `pnpm build`，再用 Electron 加载 `dist/index.html`。

## 打包

生成未压缩的桌面目录：

```bash
pnpm desktop:pack
```

生成安装包：

```bash
pnpm desktop:dist
```

Windows 产物会输出到 `release/`，默认包含 NSIS 安装包和 portable 版本。

## 后端地址

桌面版默认连接公开后端：

```text
https://airi-backend.onrender.com
```

如果要连接本地 FastAPI 后端，请先启动后端：

```bash
python -m uvicorn backend.main:app --reload
```

然后在当前终端覆盖桌面版后端地址：

```powershell
$env:AIGRIL_BACKEND_URL = "http://127.0.0.1:8000"
pnpm desktop:start
```

开发模式同样支持这个变量：

```powershell
$env:AIGRIL_BACKEND_URL = "http://127.0.0.1:8000"
pnpm desktop:dev
```
