#!/bin/bash
# 安装 TinyImage 到 macOS Finder 右键菜单（快速操作）
# 使用方式: chmod +x install-macos-service.sh && ./install-macos-service.sh

set -e

SERVICE_NAME="TinyImage压缩"
WORKFLOW_DIR="$HOME/Library/Services/${SERVICE_NAME}.workflow"
CONTENTS_DIR="$WORKFLOW_DIR/Contents"

echo "📦 正在安装 Finder 右键快速操作: ${SERVICE_NAME}"
echo ""
printf '请输入快捷键（@=⌘ ^=⌃ ~=⌥ $=⇧，默认 @$m 即 ⌘⇧M，留空跳过）: '
read -r SHORTCUT
[ -z "$SHORTCUT" ] && SHORTCUT='@$m'
echo ""

mkdir -p "$CONTENTS_DIR"

# ---------------------------------------------------------------
# 生成 document.wflow（Automator 工作流定义）
# 使用 Python 处理 XML 转义，避免 shell 引号嵌套问题
# ---------------------------------------------------------------
python3 - "$CONTENTS_DIR" "$SHORTCUT" << 'PYEOF'
import sys
import xml.sax.saxutils as saxutils

contents_dir = sys.argv[1]
shortcut = sys.argv[2] if len(sys.argv) > 2 else ""

# 嵌入到 Automator 工作流的 shell 脚本
# 当用户在 Finder 右键点击后，此脚本以选中路径作为 "$@" 参数运行
EMBEDDED_SHELL = r"""export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.npm-global/bin:$PATH"
# 跳过 Volta shim 的文件系统版本检测，避免触发 macOS 权限弹窗，使用 Volta 默认 Node 版本
export VOLTA_BYPASS=1

TINY=$(which tiny 2>/dev/null)
if [ -z "$TINY" ]; then
  osascript -e 'display alert "TinyImage 未找到" message "请先运行: npm i tinyimage -g"'
  exit 1
fi

# 将选中路径写入临时列表（NUL 分隔，兼容含空格文件名）
TMPLIST=$(mktemp /tmp/tinyimage_list_XXXXX)
TMPSCRIPT=$(mktemp /tmp/tinyimage_run_XXXXX)

printf '%s\0' "$@" > "$TMPLIST"

cat > "$TMPSCRIPT" << 'INNER'
#!/bin/bash
# $1 = 路径列表文件，$2 = tiny 可执行文件完整路径
TMPLIST="$1"
TINY="$2"
echo "================================================"
echo "  TinyImage 图片压缩"
echo "================================================"
while IFS= read -r -d '' f; do
  "$TINY" compress "$f"
done < "$TMPLIST"
rm -f "$TMPLIST"
echo "================================================"
echo "按回车键关闭窗口..."
read
osascript -e 'tell application "Terminal" to close first window'
INNER

chmod +x "$TMPSCRIPT"
# 将已解析的 $TINY 路径作为第二参数传入，避免内层脚本在 VOLTA_BYPASS 环境下重新查找
osascript -e "tell application \"Terminal\" to do script \"'$TMPSCRIPT' '$TMPLIST' '$TINY'; rm -f '$TMPSCRIPT'\""
osascript -e 'tell application "Terminal" to activate'
"""

escaped_shell = saxutils.escape(EMBEDDED_SHELL)

doc_wflow = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>AMApplicationBuild</key>
\t<string>523</string>
\t<key>AMApplicationVersion</key>
\t<string>2.10</string>
\t<key>AMDocumentVersion</key>
\t<string>2</string>
\t<key>actions</key>
\t<array>
\t\t<dict>
\t\t\t<key>action</key>
\t\t\t<dict>
\t\t\t\t<key>AMAccepts</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Container</key>
\t\t\t\t\t<string>List</string>
\t\t\t\t\t<key>Optional</key>
\t\t\t\t\t<true/>
\t\t\t\t\t<key>Types</key>
\t\t\t\t\t<array>
\t\t\t\t\t\t<string>com.apple.cocoa.path</string>
\t\t\t\t\t</array>
\t\t\t\t</dict>
\t\t\t\t<key>AMActionVersion</key>
\t\t\t\t<string>2.0.3</string>
\t\t\t\t<key>AMApplication</key>
\t\t\t\t<array>
\t\t\t\t\t<string>Automator</string>
\t\t\t\t</array>
\t\t\t\t<key>AMParameterProperties</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>COMMAND_STRING</key>
\t\t\t\t\t<dict/>
\t\t\t\t\t<key>CheckedForUserDefaultShell</key>
\t\t\t\t\t<dict/>
\t\t\t\t\t<key>inputMethod</key>
\t\t\t\t\t<dict/>
\t\t\t\t\t<key>shell</key>
\t\t\t\t\t<dict/>
\t\t\t\t\t<key>source</key>
\t\t\t\t\t<dict/>
\t\t\t\t</dict>
\t\t\t\t<key>AMProvides</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>Container</key>
\t\t\t\t\t<string>List</string>
\t\t\t\t\t<key>Types</key>
\t\t\t\t\t<array>
\t\t\t\t\t\t<string>com.apple.cocoa.path</string>
\t\t\t\t\t</array>
\t\t\t\t</dict>
\t\t\t\t<key>ActionBundlePath</key>
\t\t\t\t<string>/System/Library/Automator/Run Shell Script.action</string>
\t\t\t\t<key>ActionName</key>
\t\t\t\t<string>Run Shell Script</string>
\t\t\t\t<key>ActionParameters</key>
\t\t\t\t<dict>
\t\t\t\t\t<key>COMMAND_STRING</key>
\t\t\t\t\t<string>""" + escaped_shell + """</string>
\t\t\t\t\t<key>CheckedForUserDefaultShell</key>
\t\t\t\t\t<true/>
\t\t\t\t\t<key>inputMethod</key>
\t\t\t\t\t<integer>1</integer>
\t\t\t\t\t<key>shell</key>
\t\t\t\t\t<string>/bin/zsh</string>
\t\t\t\t\t<key>source</key>
\t\t\t\t\t<string></string>
\t\t\t\t</dict>
\t\t\t\t<key>BundleIdentifier</key>
\t\t\t\t<string>com.apple.RunShellScript</string>
\t\t\t\t<key>CFBundleVersion</key>
\t\t\t\t<string>2.0.3</string>
\t\t\t\t<key>CanShowSelectedItemsWhenRun</key>
\t\t\t\t<false/>
\t\t\t\t<key>CanShowWhenRun</key>
\t\t\t\t<true/>
\t\t\t\t<key>Category</key>
\t\t\t\t<array>
\t\t\t\t\t<string>AMCategoryUtilities</string>
\t\t\t\t</array>
\t\t\t\t<key>Class Name</key>
\t\t\t\t<string>RunShellScriptAction</string>
\t\t\t\t<key>InputUUID</key>
\t\t\t\t<string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
\t\t\t\t<key>Keywords</key>
\t\t\t\t<array>
\t\t\t\t\t<string>Shell</string>
\t\t\t\t\t<string>Script</string>
\t\t\t\t\t<string>Command</string>
\t\t\t\t\t<string>Run</string>
\t\t\t\t\t<string>Unix</string>
\t\t\t\t</array>
\t\t\t\t<key>OutputUUID</key>
\t\t\t\t<string>B2C3D4E5-F6A7-8901-BCDE-F12345678901</string>
\t\t\t\t<key>UUID</key>
\t\t\t\t<string>C3D4E5F6-A7B8-9012-CDEF-123456789012</string>
\t\t\t\t<key>UnlockActionForAccessibility</key>
\t\t\t\t<false/>
\t\t\t</dict>
\t\t</dict>
\t</array>
\t<key>connectors</key>
\t<dict/>
\t<key>workflowMetaData</key>
\t<dict>
\t\t<key>applicationBundleIDsByPath</key>
\t\t<dict/>
\t\t<key>applicationPaths</key>
\t\t<array/>
\t\t<key>inputTypeIdentifier</key>
\t\t<string>com.apple.Automator.fileSystemObject</string>
\t\t<key>outputTypeIdentifier</key>
\t\t<string>com.apple.Automator.nothing</string>
\t\t<key>presentationMode</key>
\t\t<integer>11</integer>
\t\t<key>processesInput</key>
\t\t<false/>
\t\t<key>serviceInputTypeIdentifier</key>
\t\t<string>com.apple.Automator.fileSystemObject</string>
\t\t<key>serviceOutputTypeIdentifier</key>
\t\t<string>com.apple.Automator.nothing</string>
\t\t<key>serviceProcessesInput</key>
\t\t<false/>
\t\t<key>systemImageName</key>
\t\t<string>NSActionTemplate</string>
\t\t<key>useAutomaticInputType</key>
\t\t<false/>
\t\t<key>workflowTypeIdentifier</key>
\t\t<string>com.apple.Automator.servicesMenu</string>
\t</dict>
</dict>
</plist>"""

output_path = contents_dir + "/document.wflow"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(doc_wflow)

print("  ✅ document.wflow 写入完成")

# ── 生成 Info.plist（含可选快捷键）────────────────────────────────
key_equiv_block = ""
if shortcut:
    key_equiv_block = (
        "\t\t\t<key>NSKeyEquivalent</key>\n"
        "\t\t\t<dict>\n"
        "\t\t\t\t<key>default</key>\n"
        "\t\t\t\t<string>" + saxutils.escape(shortcut) + "</string>\n"
        "\t\t\t</dict>\n"
    )

info_plist = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
    '<plist version="1.0">\n'
    '<dict>\n'
    '\t<key>NSServices</key>\n'
    '\t<array>\n'
    '\t\t<dict>\n'
    '\t\t\t<key>NSMenuItem</key>\n'
    '\t\t\t<dict>\n'
    '\t\t\t\t<key>default</key>\n'
    '\t\t\t\t<string>TinyImage压缩</string>\n'
    '\t\t\t</dict>\n'
    + key_equiv_block +
    '\t\t\t<key>NSMessage</key>\n'
    '\t\t\t<string>runWorkflowAsService</string>\n'
    '\t\t\t<key>NSPortName</key>\n'
    '\t\t\t<string>TinyImage压缩</string>\n'
    '\t\t\t<key>NSRequiredContext</key>\n'
    '\t\t\t<dict/>\n'
    '\t\t\t<key>NSSendFileTypes</key>\n'
    '\t\t\t<array>\n'
    '\t\t\t\t<string>public.item</string>\n'
    '\t\t\t</array>\n'
    '\t\t</dict>\n'
    '\t</array>\n'
    '</dict>\n'
    '</plist>'
)

info_path = contents_dir + "/Info.plist"
with open(info_path, "w", encoding="utf-8") as f:
    f.write(info_plist)

print("  ✅ Info.plist 写入完成")
PYEOF

# ---------------------------------------------------------------
# 刷新 macOS 服务缓存
# ---------------------------------------------------------------
/System/Library/CoreServices/pbs -update 2>/dev/null || true

echo ""
echo "✅ 安装完成！"
echo ""
echo "使用方式："
echo "  在 Finder 中选中图片或文件夹 → 右键 → 快速操作 → TinyImage压缩"
if [ -n "$SHORTCUT" ]; then
  echo "  或直接使用快捷键：${SHORTCUT}（选中文件时生效）"
  echo ""
  echo "  若快捷键不生效，请在「系统设置 → 键盘 → 键盘快捷键 → 服务」中手动确认并勾选"
fi
echo ""
echo "如果菜单没有出现，请手动启用："
echo "  系统设置 → 隐私与安全性 → 扩展 → Finder"
echo "  勾选「TinyImage压缩」"
echo ""
echo "卸载方式："
echo "  rm -rf ~/Library/Services/TinyImage压缩.workflow"
