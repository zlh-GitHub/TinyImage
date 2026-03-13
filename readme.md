# TinyImage 压缩图片

TinyImage 使用网页版 TinyPNG 的压缩接口 `https://tinypng.com/web/shrink` 批量压缩 PNG/JPEG 图片，**无需 API Key**。参考借鉴知乎专栏《原来TinyPNG可以这样玩!》：[原文链接](https://zhuanlan.zhihu.com/p/152317953)。

提供两种使用方式：

- **VS Code 插件**：在资源管理器中右键图片/文件夹即可压缩
- **npm 命令行**：全局安装后使用 `tiny` 进入交互式菜单，或集成到脚本

---

## 通用说明

1. **格式**：仅支持 `png`、`jpg`、`jpeg`
2. **大小**：受网页版接口限制，单张图片最大 5MB（5120KB）
3. **并发**：内置队列与重试，压缩多张时自动限流

---

## 一、VS Code 插件

### 安装

在 VS Code 扩展市场搜索 **TinyImage**（publisher: linkhopes）安装，或从 [VS Code Marketplace](https://marketplace.visualstudio.com/) 安装。

### 使用

- **压缩单张/多张图片**：在资源管理器中右键一张或多张图片 → 选择 **「TinyImage: 压缩图片」**
- **压缩文件夹内图片**：右键目标文件夹 → 选择 **「TinyImage: 压缩文件夹内图片」**

压缩进度在通知栏显示，详细日志在输出面板的 **TinyImage** 通道中查看。

### 插件配置

在 VS Code 设置中搜索 `tinyimage`，可配置：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `tinyimage.minSize` | number | 10 | 最小压缩文件大小（KB），小于此值的文件会跳过 |
| `tinyimage.retain` | boolean | false | 为 true 时保留原文件，压缩结果另存为 `.tiny` 后缀文件 |
| `tinyimage.deep` | boolean | true | 压缩文件夹时是否递归处理子目录 |

---

## 二、npm 命令行

### 安装

```bash
npm i tinyimage -g
```

### 使用

安装后执行：

```bash
tiny
```

会进入交互式菜单，可选：

- **压缩文件夹**：输入文件夹路径，递归压缩该目录下所有符合条件的图片
- **压缩单张图片**：输入图片路径进行压缩
- **查看当前配置**：查看 `basePath`、`minSize`
- **修改当前配置**：设置基路径（basePath）、最小压缩大小（minSize，单位 KB）

### 配置说明（命令行）

- **basePath**：基路径。设置后，在「压缩单张图片」或「压缩文件夹」时输入的路径将相对于该基路径解析；留空则按当前工作目录下的绝对/相对路径解析。
- **minSize**：最小文件大小（KB），仅对「压缩文件夹」生效，小于此大小的图片会跳过。须为正整数，且小于 5120。

配置保存在项目下的 `config.json` 中（与运行 `tiny` 时的当前目录相关）。

---

## 开发与打包

- 构建：`npm run build`
- 监听：`npm run watch`
- 打包 VS Code 扩展：`npm run package:vscode`
- 打包 npm 包：`npm run package:npm`

---

## 许可与致谢

- 接口与思路致谢：TinyPNG 网页版、知乎专栏作者
- 本仓库许可证：ISC
