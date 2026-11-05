#!/bin/bash
# ============================================================================
#  DEMO LAB · 交互实验室 —— 双击这个文件即可在浏览器里打开作品集
#
#  说明：六个 Demo 的构建产物都是纯静态站点资源；其中 RAG 观测台的回答生成需要
#  本地模型转发（/api/llm，检索仍全在浏览器内），mini-opencode 需要本地真实 Agent 后端。
#  浏览器出于安全限制不允许直接双击 site/index.html 打开（ES Module /
#  模型加载会被 CORS 拦截，页面会空白），所以要先起本地服务再访问。
#
#  这个脚本会：
#    1) 起静态服务（http://127.0.0.1:5180/）
#    2) 同时拉起 mini-opencode 的真实 Agent 后端，并把 /api/* 代理过去
#    3) 同时为 RAG 观测台提供 /api/llm 真实模型转发（只注入 Key + 绕开 CORS，不是 RAG 后端）
#    4) 自动打开浏览器
#
#  真实 Agent 的模型 key 配在 apps/agent-lab/.env（面板右上角也能改）；
#  RAG 观测台的模型 key 配在 apps/rag-lab/.env，或直接复用 apps/agent-lab/.env。
#  关闭此终端窗口即停止预览（Agent 子进程也会一起退出）。
# ============================================================================
cd "$(dirname "$0")" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 没有找到 node，请先安装 Node.js（https://nodejs.org）"
  read -r -p "按回车退出…"
  exit 1
fi

if [ ! -f site/index.html ]; then
  echo "首次运行：正在构建站点，请稍候…"
  npm install --no-audit --no-fund
  npm run build || { echo "✗ 构建失败"; read -r -p "按回车退出…"; exit 1; }
fi

# 找一个没被占用的端口
PORT=5180
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 5200 ]; then echo "✗ 5180-5200 端口都被占用"; read -r -p "按回车退出…"; exit 1; fi
done

URL="http://127.0.0.1:$PORT/"
echo ""
echo "  DEMO LAB · 交互实验室"
echo "  ─────────────────────────────────────────"
echo "  预览地址：$URL"
echo "  · 前四个 Demo：纯静态构建产物，点开即玩"
echo "  · RAG 观测台：浏览器内检索管线 + 真实大模型生成（本地 /api/llm 薄转发）"
echo "    模型 key 配在 apps/rag-lab/.env，或复用 apps/agent-lab/.env"
echo "  · mini-opencode：真实 Agent（真模型 / 真工具 / 真审批）"
echo "    模型 key 配在 apps/agent-lab/.env，或在面板右上角「模型配置」里填"
echo "  关闭此终端窗口即停止预览（Agent 后端会一起退出）。"
echo ""

(sleep 1.2; open "$URL" 2>/dev/null || true) &

exec node scripts/serve-site.mjs "$PORT"
