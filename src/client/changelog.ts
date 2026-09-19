/** 更新公告正文（v0.1.0）。呈现时按纯文本保留换行，不做 md 渲染。 */
export const CHANGELOG_VERSION = 'v0.1.0'
export const CHANGELOG_CURRENT = `更新公告 · v0.1.0

🧩 插件包化

工作台现在以标准 DSH 插件包的形式安装与运行，不再是本地 link 项目：

- 安装：npm pack 出 tarball → dsh plugin --profile mytable add "file:<tarball>"
  （包内 dsh.bundle.patch 让 CLI 自动把它加进 dsh.profile.bundles，无需手写挂载行）
- 启动：dsh --profile mytable（独立 profile，与 web profile 互不干扰）
- 卸载：dsh plugin --profile mytable remove dsh-mytable

⚙️ 设置 →「工作台」

DSH 设置里新增一节「工作台」，两组开关随手可调：

- 窗口类型：浏览器 / 动画 / 资源管理器 / 终端 / ✨自定义
  关掉后该类型不再出现在「新建窗口」选择器里（已打开的窗口不受影响）
- 文件预览：网页 / Markdown / 代码 / 纯文本 / 图片 / PDF
  网页 / Markdown / 代码 关掉后退化为纯文本；图片 / PDF / 纯文本 关掉后显示提示

改完即时生效，已打开的窗口与选择器立刻跟随。

🔑 状态键

项目、对话绑定、布局、控制室背景等全部存在 dsh.mytable.*（localStorage）与 IndexedDB dsh-mytable。

🔄 更新方式

本包未发布到任何公开仓库：设置里的「检查更新」不再比对远端（不会提示新版本）。
升级 = 在本机重新构建打包后重装，升级指令可在本面板「复制升级指令」里一键复制。
`
