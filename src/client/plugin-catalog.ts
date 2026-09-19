/**
 * 「添加窗口插件 / 添加预览插件」面板里那份**推荐插件目录**。
 *
 * 工作台把窗口类型与文件预览的注册接口开放给其它插件（`ctx.mytable`，见 README §4.1）。
 * 这个数组是人工维护的收录表：谁写出了可用的工作台扩展插件，就往这里加一条，
 * 面板里就会出现「名称 + 跳转/复制 + 说明 + 安装命令」的条目（形态对齐 dsh-better-sidebar
 * 的「添加 Tab 插件」面板）。
 *
 * 为什么默认是空的：`ctx.mytable` 是刚开放的接口，尚无第三方插件登记——不编造条目。
 * 面板里另外提供「装任意插件」输入框（生成 `dsh plugin --profile <profile> add "<输入>"`），
 * 以及 GitHub topic 链接，所以在目录为空时依然可用。
 *
 * 字段：
 *   name    插件显示名（如 "dsh-sentinel 唤醒系统"）
 *   desc    一句话说明（会显示在条目里，搜索会同时匹配 name 与 desc）
 *   install 完整安装命令（照抄给用户执行；形如 `cd ~/.dsh && dsh plugin --profile mytable add "<包名或地址>"`）
 *   url     可选，跳转地址（GitHub 仓库等）
 */
export type RecommendedPlugin = {
  name: string
  desc: string
  install: string
  url?: string
}

/** 收录表（可直接在运行时查看：window.__dshMytableCatalog）。 */
export const RECOMMENDED_PLUGINS: RecommendedPlugin[] = [
  // 示例（当前为空是有意为之——不编造不存在的插件）：
  // {
  //   name: 'dsh-xxxx 工作台扩展',
  //   desc: '通过 ctx.mytable 注册一个 xxx 窗口类型：……',
  //   install: 'cd ~/.dsh && dsh plugin --profile mytable add "github:you/dsh-xxxx"',
  //   url: 'https://github.com/you/dsh-xxxx',
  // },
]

/** 「浏览更多插件」的 GitHub topic（收录表之外的插件可自行用这个主题标记）。 */
export const PLUGIN_TOPIC_URL = 'https://github.com/topics/dsh-mytable'
