// 设置节新版式 + 「添加插件」面板验收：
//   A. 分组各自成框，框内卡片一排两个，组末尾是可点开的「添加…插件＋」
//   B. 点开后：说明文案 / GitHub topic 链接 / 搜索框 / 推荐插件计数 / 条目（名称+跳转+复制+说明+安装命令）
//   C. 搜索过滤、空态说明、「装任意插件」生成安装命令并可复制
// 用法：node tests/cdp-probe.mjs <ws> <url> tests/verify-add-panel.js [png] fresh
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }

const trigger = document.querySelector('[data-slot="sidebar.settings"] button')
if (!trigger) return { fail: true, why: 'no settings trigger' }
trigger.click()
for (let i = 0; i < 40 && !document.querySelector('.dsh-mt_set'); i++) await sleep(250)
const nav = [...document.querySelectorAll('button')].find((b) => /工作台/.test(b.textContent || '') && !/dsh-mt_/.test(String(b.className)))
if (!nav) return { fail: true, why: 'no worktable nav item' }
nav.click()
await sleep(800)
const body = document.querySelector('.dsh-mt_set')
if (!body) return { fail: true, why: 'no section body' }

// ── A. 版式：分组各自成框 + 框内两列 ────────────────────────────────────
const groups = [...body.querySelectorAll('.dsh-mt_setGroup')]
step('两个分组（窗口类型 / 文件预览）', groups.length === 2, groups.map((g) => g.querySelector('.dsh-mt_setGroupTitle')?.textContent).join(' | '))
const gridInfo = groups.map((g) => {
  const grid = g.querySelector('.dsh-mt_setGrid')
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns : ''
  const cs = getComputedStyle(g)
  return {
    title: g.querySelector('.dsh-mt_setGroupTitle')?.textContent,
    tracks: cols.split(' ').filter((x) => x && x !== 'none').length,
    cols,
    border: cs.borderTopWidth,
    radius: cs.borderTopLeftRadius,
    cards: g.querySelectorAll('.dsh-mt_setCard').length,
    addTile: g.querySelectorAll('.dsh-mt_setAdd').length,
  }
})
out.groups = gridInfo
step('分组各自独立成框（边框 + 圆角）', gridInfo.every((g) => parseFloat(g.border) > 0 && parseFloat(g.radius) > 0),
  gridInfo.map((g) => `${g.title}:${g.border}/${g.radius}`).join(' , '))
step('框内卡片一排两个（2 列网格）', gridInfo.every((g) => g.tracks === 2), gridInfo.map((g) => `${g.title}:${g.cols}`).join(' | '))
step('每组末尾都有「添加…插件＋」磁贴', gridInfo.every((g) => g.addTile === 1), gridInfo.map((g) => `${g.title}:${g.addTile}`).join(' , '))
const addPanes = [...body.querySelectorAll('.dsh-mt_setAdd')]
step('磁贴文案正确', /添加窗口插件/.test(addPanes[0]?.textContent || '') && /添加预览插件/.test(addPanes[1]?.textContent || ''),
  addPanes.map((b) => b.textContent.trim()).join(' | '))

// ── B. 点开「添加窗口插件」 ─────────────────────────────────────────────
addPanes[0].click()
await sleep(600)
const panel = document.querySelector('.dsh-mt_addPanel')
step('点开出现面板', !!panel, panel ? 'ok' : 'no .dsh-mt_addPanel')
if (!panel) return out
step('说明文案说明「可由插件扩展 + ctx.mytable + 复制命令到终端」',
  /可以由插件扩展/.test(panel.textContent || '') && /ctx\.mytable/.test(panel.textContent || '') && /复制/.test(panel.textContent || ''),
  (panel.querySelector('.dsh-mt_addIntro')?.textContent || '').slice(0, 56))
const topic = panel.querySelector('.dsh-mt_addTopic')
step('GitHub topic 链接', !!topic && /github\.com\/topics\/dsh-mytable/.test(topic.getAttribute('href') || ''), topic ? topic.getAttribute('href') : null)
step('搜索框存在', !!panel.querySelector('.dsh-mt_addSearch'), panel.querySelector('.dsh-mt_addSearch')?.getAttribute('placeholder'))
step('有「推荐插件」标题与计数', /推荐插件/.test(panel.textContent || '') && !!panel.querySelector('.dsh-mt_addCount'),
  'count=' + (panel.querySelector('.dsh-mt_addCount')?.textContent ?? '?'))
const panelText = panel.textContent || ''
step('空目录给空态说明（不编造条目）', /暂无收录/.test(panelText), (panel.querySelector('.dsh-mt_addEmpty')?.textContent || '').slice(0, 40))

// 注入两条推荐条目（模拟维护者往 plugin-catalog 里加了插件），验证条目渲染 + 搜索过滤
const catalog = window.__dshMytableCatalog
if (Array.isArray(catalog)) {
  catalog.push(
    { name: 'dsh-alpha 地图窗口', desc: '注册一个地图窗口类型', install: 'cd ~/.dsh && dsh plugin --profile mytable add "dsh-alpha"', url: 'https://github.com/x/dsh-alpha' },
    { name: 'dsh-beta 日志预览', desc: '接管 .log 文件的预览器', install: 'cd ~/.dsh && dsh plugin --profile mytable add "dsh-beta"', url: 'https://github.com/x/dsh-beta' },
  )
}
// 触发重渲染：把搜索词改成非空再继续（受控输入，值不变不会重渲染）
const search = panel.querySelector('.dsh-mt_addSearch')
const setInput = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
setInput(search, 'dsh')
await sleep(500)
const items = () => [...panel.querySelectorAll('.dsh-mt_addItem')]
out.itemsAfterInject = items().map((it) => it.querySelector('.dsh-mt_addItemName')?.textContent)
const first = items()[0]
step('推荐条目按「名称 + 跳转/复制 + 说明 + 安装命令」渲染',
  items().length === 2
  && !!(first && first.querySelector('.dsh-mt_addItemDesc'))
  && !!(first && first.querySelector('.dsh-mt_addCmd'))
  && (first ? first.querySelectorAll('.dsh-mt_addBtn').length : 0) === 2,
  out.itemsAfterInject.join(' , ') || '(no items)')
step('安装命令文案含 profile 与包名', /dsh plugin --profile mytable add "dsh-alpha"/.test(first?.querySelector('.dsh-mt_addCmd')?.textContent || ''),
  first?.querySelector('.dsh-mt_addCmd')?.textContent ?? '(none)')

setInput(search, '日志')
await sleep(400)
out.filtered = items().map((it) => it.querySelector('.dsh-mt_addItemName')?.textContent)
step('搜索按名称/描述过滤', out.filtered.length === 1 && /beta/.test(out.filtered[0] || ''), out.filtered.join(' , '))
setInput(search, 'zzz-nothing')
await sleep(400)
step('无匹配时列表为空', items().length === 0, String(items().length))
setInput(search, '')
await sleep(400)
step('清空搜索后条目回来', items().length === 2, String(items().length))

// ── C. 装任意插件：生成安装命令 ────────────────────────────────────────
const inputs = [...panel.querySelectorAll('.dsh-mt_addSearch')]
const manual = inputs[inputs.length - 1]
setInput(manual, 'dsh-gamma')
await sleep(300)
const manualCmd = [...panel.querySelectorAll('.dsh-mt_addCmd')].pop()?.textContent || ''
step('「装任意插件」生成 profile 安装命令', /dsh plugin --profile mytable add "dsh-gamma"/.test(manualCmd), manualCmd)
const copyBtn = [...panel.querySelectorAll('.dsh-mt_addBtn')].find((b) => /复制安装命令/.test(b.textContent || ''))
step('复制按钮可用（未禁用）', !!copyBtn && !copyBtn.disabled, copyBtn ? String(copyBtn.textContent).trim() : null)
// 点复制：headless 下 clipboard 可能被拒，断言按钮进入「已复制」或出现失败提示（两者都说明点击链路通）
copyBtn && copyBtn.click()
await sleep(500)
const afterCopy = panel.textContent || ''
step('点击复制有反馈（已复制 / 复制失败提示）', /已复制|复制失败/.test(afterCopy), /已复制/.test(afterCopy) ? '已复制' : '复制失败提示')

// 关闭面板
const closeBtn = panel.querySelector('.dsh-mt_addClose')
closeBtn && closeBtn.click()
await sleep(400)
step('可关闭面板', !document.querySelector('.dsh-mt_addPanel'), null)

return out
