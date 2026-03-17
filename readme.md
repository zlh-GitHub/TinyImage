# TinyImage 压缩图片

TinyImage 支持多种图片格式的压缩，提供两种使用方式：

- **VS Code 插件**：在资源管理器中右键图片/文件夹即可压缩
- **npm 命令行**：全局安装后使用 `tiny` 进入交互式菜单，或集成到脚本

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

进入交互式菜单，可选：

- **压缩文件夹**：输入文件夹路径，递归压缩该目录下所有符合条件的图片
- **压缩单张图片**：输入图片路径进行压缩
- **查看当前配置**：查看 `basePath`、`minSize`、`retain`
- **修改当前配置**：设置基路径、最小压缩大小、是否保留原文件

### 配置说明

| 配置项 | 说明 |
|--------|------|
| `basePath` | 基路径。设置后输入的路径将相对于该基路径解析；留空则按当前工作目录解析 |
| `minSize` | 最小文件大小（KB），小于此大小的图片跳过，须为正整数 |
| `retain` | 为 true 时保留原文件，压缩结果另存为 `.tiny` 后缀文件 |

配置保存在 `config.json` 中。

---

## 开发与打包

```bash
npm run build          # 编译 TypeScript
npm run watch          # 监听模式
npm run package:vscode # 打包 VS Code 扩展（.vsix）
npm run package:npm    # 打包 npm 包
```

---

## 许可

ISC
