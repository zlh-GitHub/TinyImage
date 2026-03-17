# TinyImage 压缩图片

TinyImage 支持多种图片格式的压缩，提供两种使用方式：

- **VS Code 插件**：在资源管理器中右键图片/文件夹即可压缩
- **npm 命令行**：全局安装后使用 `tiny` 进入交互式菜单

### 支持格式

| 格式 | 压缩方式 | 说明 |
|------|----------|------|
| PNG | TinyPNG 接口（云端） | 无需 API Key，最大 5MB |
| JPG / JPEG | MozJPEG（本地） | 自适应质量，最大 5MB |
| SVG | SVGO（本地） | 多轮优化，移除冗余节点 |

---

## 一、VS Code 插件

### 安装

在 VS Code 扩展市场搜索 **TinyImage**（publisher: linkhopes）安装。

### 使用

- **压缩单张/多张图片**：在资源管理器中右键一张或多张图片 → 选择 **「TinyImage: 压缩图片」**
- **压缩文件夹内图片**：右键目标文件夹 → 选择 **「TinyImage: 压缩文件夹内图片」**

压缩进度在通知栏显示，详细日志在输出面板的 **TinyImage** 通道中查看。

### 插件配置

在 VS Code 设置中搜索 `tinyimage`，可配置：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `tinyimage.minSize` | number | 10 | 最小压缩文件大小（KB），小于此值的文件跳过 |
| `tinyimage.retain` | boolean | false | 为 true 时保留原文件，压缩结果另存为 `.tiny` 后缀 |
| `tinyimage.deep` | boolean | true | 压缩文件夹时是否递归处理子目录 |

---

## 二、npm 命令行

### 安装

```bash
npm i tinyimage -g
```

### 使用

```bash
tiny
```

进入交互式菜单，可选：

- **压缩文件夹**：递归压缩该目录下所有符合条件的图片
- **压缩单张图片**：输入图片路径进行压缩
- **查看当前配置** / **修改当前配置**

### 配置说明（`config.json`）

| 配置项 | 说明 |
|--------|------|
| `basePath` | 基路径。设置后输入的路径将相对于该基路径解析；留空则按当前工作目录解析 |
| `minSize` | 最小文件大小（KB），小于此大小的图片跳过 |
| `retain` | 为 true 时保留原文件，压缩结果另存为 `.tiny` 后缀 |

---

## 三、开发

### 环境要求

- Node.js >= 14（推荐使用项目内置的 Volta 版本 `node@24`）
- npm

### 安装依赖

```bash
npm install
```

### 目录结构

```
├── index.ts               # CLI 入口
├── extension.ts           # VS Code 插件入口
├── config.json            # 默认配置
├── src/
│   ├── core.ts            # 核心逻辑（过滤、压缩调度、诊断）
│   ├── compressors/
│   │   ├── types.ts       # ICompressor 接口
│   │   ├── registry.ts    # CompressorRegistry（格式 → 压缩器映射）
│   │   ├── tinypng.ts     # PNG 压缩器（TinyPNG 云端 API）
│   │   ├── mozjpeg.ts     # JPEG 压缩器（sharp + MozJPEG）
│   │   ├── svgo.ts        # SVG 压缩器（svgo）
│   │   └── index.ts       # 默认 Registry 及统一导出
│   └── vendor.d.ts        # 第三方模块类型声明
└── dist/                  # 编译产物（git 忽略）
```

### 编译

```bash
npm run build    # 一次性编译
npm run watch    # 监听模式，修改后自动重编译
```

### 新增压缩格式

1. 在 `src/compressors/` 下新建 `<format>.ts`，实现 `ICompressor` 接口：

```ts
import { ICompressor, CompressorOutput } from './types';

export class WebPCompressor implements ICompressor {
  readonly name = 'webp';
  readonly supportedExtensions = ['webp'];

  async compress(inputBuffer: Buffer): Promise<CompressorOutput> {
    // ...
  }
}
```

2. 在 `src/compressors/index.ts` 中注册：

```ts
import { WebPCompressor } from './webp';

export const defaultRegistry = new CompressorRegistry()
  // ...
  .register(new WebPCompressor());
```

3. 在 `config.json` 的 `exts` 数组中加入新格式，并更新 `package.json` 里菜单的 `when` 条件。

---

## 四、调试

项目内置了两个 VS Code 调试配置（`.vscode/launch.json`）：

### 调试 VS Code 插件

1. 用 VS Code 打开本项目
2. 按 `F5` 或在「运行和调试」面板选择 **Run Extension**
3. 会启动一个新的 Extension Development Host 窗口，在其中右键图片即可触发断点

### 调试 CLI（VS Code）

1. 在「运行和调试」面板选择 **Launch Program**
2. 会先执行 `npm run build`，再以 Node.js 调试模式运行 `dist/index.js`
3. 在源码中打断点，sourcemap 已开启，可直接在 `.ts` 文件中调试

### 本地 npm link 联调

开发时可以通过 `npm link` 将本地包链接为全局命令，直接在终端用 `tiny` 测试：

```bash
npm link
tiny
```

**为什么需要 `prepare` 脚本？**

`npm link` 会在全局 bin 目录创建指向本地 `dist/index.js` 的软链接。但如果此时 `dist/` 还不存在或内容陈旧，`tiny` 命令就会报错或运行旧代码。

`package.json` 中配置了：

```json
"prepare": "npm run build"
```

`prepare` 是 npm 的生命周期钩子，**在执行 `npm link` 之前会自动触发**，确保链接前代码已编译完毕。无需手动先跑 `npm run build`，避免"改了代码但 `tiny` 还是旧版本"的问题。

> 同理，`npm install` 和 `npm publish` 前也会自动执行 `prepare`，保证发布和安装时始终附带最新构建产物。

---

## 五、打包

### VS Code 扩展（.vsix）

```bash
npm run package:vscode
```

生成 `tinyimage-<version>.vsix`，可通过 VS Code「从 VSIX 安装」本地安装，或上传到扩展市场。

### npm 包

```bash
npm run package:npm
```

生成 `tinyimage-<version>.tgz`，可本地 `npm install <tgz>` 测试，或发布到 npm。

---

## 六、发布

### 发布 VS Code 扩展

确保已安装并登录 `@vscode/vsce`：

```bash
npm install -g @vscode/vsce
vsce login <publisher>   # 首次需要 Personal Access Token
npm run package:vscode   # 生成 .vsix
vsce publish             # 直接发布到市场
```

或在 [Visual Studio Marketplace 管理后台](https://marketplace.visualstudio.com/manage) 手动上传 `.vsix`。

### 发布 npm 包

```bash
npm login                # 首次需要登录
npm version patch        # 升级版本号（patch / minor / major）
npm run package:npm
npm publish
```

---

## 许可

ISC
