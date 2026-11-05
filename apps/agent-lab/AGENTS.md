# 项目规则（AGENTS.md）

> 你可能好奇：这个文件是给谁看的？
>
> 它是给 **Agent** 看的。`mini-opencode` 启动时会把当前目录下的 `AGENTS.md`
> 自动拼进系统提示词（system prompt），于是模型一上来就知道这个项目的规矩。
>
> 真实 opencode 也支持 `AGENTS.md`（以及全局 `~/.config/opencode/AGENTS.md`），
> 这是"把项目知识喂给 Agent"最便宜、最有效的手段之一。

## 这个项目是什么

这是一个**教学项目**：从零手搓一个 mini 版 opencode，用来学习 Agent 的工作原理。
代码里的注释就是教材，文档在 `docs/` 目录。

## 给 Agent 的规矩

- 这是教学代码：**不要引入任何第三方运行时依赖**（node_modules 里的 devDependencies 除外）。
- **所有注释和文档用中文**，风格要"把概念揉碎了讲"，不要只写"这里做了什么"，要写"为什么"。
- 修改代码前先读 `docs/` 里对应章节，保持代码与文档一致。
- 不要动 `.mini-opencode/` 目录（那是会话记录）。
- 网页前端在 `src/web/public/`：保持纯原生、无 CDN、无构建；所有模型/工具输出必须用
  `textContent` 渲染（防 XSS），禁止 `innerHTML` 拼接。
- 跑测试用 `npm test`。
