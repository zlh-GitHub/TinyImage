#!/bin/bash
# 安装 TinyImage 到 macOS Finder 右键菜单（快速操作）
# 使用方式: chmod +x install-macos-service.sh && ./install-macos-service.sh

set -e

SERVICE_NAME="TinyImage压缩"
WORKFLOW_DIR="$HOME/Library/Services/${SERVICE_NAME}.workflow"
CONTENTS_DIR="$WORKFLOW_DIR/Contents"

echo "📦 正在安装 Finder 右键快速操作: ${SERVICE_NAME}"

mkdir -p "$CONTENTS_DIR"

# ---------------------------------------------------------------
# 生成 document.wflow（Automator 工作流定义）
# 使用 Python 处理 XML 转义，避免 shell 引号嵌套问题
# ---------------------------------------------------------------
python3 - "$CONTENTS_DIR" << 'PYEOF'
import sys
import xml.sax.saxutils as saxutils

contents_dir = sys.argv[1]

# 嵌入到 Automator 工作流的 shell 脚本
# 当用户在 Finder 右键点击后，此脚本以选中路径作为 "$@" 参数运行
EMBEDDED_SHELL = r"""export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.npm-global/bin:$PATH"

TINY=$(which tiny 2>/dev/null)
if [ -z "$TINY" ]; then
  osascript -e 'display alert "TinyImage 未找到" message "请先运行: npm i tinyimage -g"'
  exit 1
fi

# 发送开始通知
osascript -e 'display notification "正在压缩，请稍候..." with title "TinyImage"'

TOTAL_SUCCESS=0
TOTAL_SKIP=0
TOTAL_ERROR=0

for f in "$@"; do
  OUTPUT=$("$TINY" compress "$f" 2>&1)
  S=$(printf '%s\n' "$OUTPUT" | grep -c "压缩成功" || true)
  SK=$(printf '%s\n' "$OUTPUT" | grep -c "已跳过" || true)
  E=$(printf '%s\n' "$OUTPUT" | grep -c "压缩失败" || true)
  TOTAL_SUCCESS=$((TOTAL_SUCCESS + S))
  TOTAL_SKIP=$((TOTAL_SKIP + SK))
  TOTAL_ERROR=$((TOTAL_ERROR + E))
done

# 发送完成通知
MSG="成功 ${TOTAL_SUCCESS} 张"
[ "$TOTAL_SKIP" -gt 0 ] && MSG="${MSG}，跳过 ${TOTAL_SKIP} 张"
[ "$TOTAL_ERROR" -gt 0 ] && MSG="${MSG}，失败 ${TOTAL_ERROR} 张"
osascript -e "display notification \"${MSG}\" with title \"TinyImage ✅\" sound name \"Glass\""
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
PYEOF

# ---------------------------------------------------------------
# 生成 Info.plist
# ---------------------------------------------------------------
cat > "$CONTENTS_DIR/Info.plist" << 'INFOPLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>TinyImage压缩</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSPortName</key>
			<string>TinyImage压缩</string>
			<key>NSRequiredContext</key>
			<dict/>
			<key>NSSendFileTypes</key>
			<array>
				<string>public.item</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
INFOPLIST

echo "  ✅ Info.plist 写入完成"

# ---------------------------------------------------------------
# 刷新 macOS 服务缓存
# ---------------------------------------------------------------
/System/Library/CoreServices/pbs -update 2>/dev/null || true

echo ""
echo "✅ 安装完成！"
echo ""
echo "使用方式："
echo "  在 Finder 中选中图片或文件夹 → 右键 → 快速操作 → TinyImage压缩"
echo ""
echo "如果菜单没有出现，请手动启用："
echo "  系统设置 → 隐私与安全性 → 扩展 → Finder"
echo "  勾选「TinyImage压缩」"
echo ""
echo "卸载方式："
echo "  rm -rf ~/Library/Services/TinyImage压缩.workflow"
