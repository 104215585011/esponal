#!/bin/bash
# Esponal 启动脚本
# 用法：bash init.sh
# 设置 RUN_START_COMMAND=1 直接启动开发服务器

INSTALL_CMD="npm install"
VERIFY_CMD="npm test"
START_CMD="npm run dev"

echo "=== Esponal Init ==="
echo "目录：$(pwd)"
echo ""

echo ">>> 安装依赖..."
$INSTALL_CMD
if [ $? -ne 0 ]; then
  echo "❌ 依赖安装失败，停止"
  exit 1
fi
echo "✅ 依赖安装完成"
echo ""

echo ">>> 运行验证..."
$VERIFY_CMD
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ 验证失败。请先修复基础状态，不要在坏的基础上继续开发。"
  echo "   查看 session-handoff.md 了解已知问题。"
  exit 1
fi
echo "✅ 验证通过"
echo ""

echo ">>> 启动命令："
echo "   $START_CMD"
echo ""

if [ "${RUN_START_COMMAND}" = "1" ]; then
  echo ">>> 启动开发服务器..."
  $START_CMD
fi
