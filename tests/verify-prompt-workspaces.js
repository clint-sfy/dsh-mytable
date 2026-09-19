// 文案工作区真机验收：内置入口、三段顺序、只写草稿、需求清空、本地持久化。
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail = '') => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }
const setNative = (node, value) => {
  const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(node, value)
  node.dispatchEvent(new Event('input', { bubbles: true }))
  node.dispatchEvent(new Event('change', { bubbles: true }))
}

localStorage.removeItem('dsh.mytable.promptWorkspaces.v1')
const store = window.__dshWorktable?.splitStore
step('splitStore debug hook', !!store)
if (!store) return out
store.open({ id: 'prompt-probe', title: 'prompt probe', top: null, main: [{ id: 'p1', title: '窗1', min: 120 }], chatWidth: { default: 420, min: 260, max: 900 } })
await sleep(1000)
const pick = [...document.querySelectorAll('.dsh-mt_panePick')].find((button) => button.textContent.includes('文案工作区'))
step('选择器里有「文案工作区」', !!pick)
pick?.click()
await sleep(900)
const pane = document.querySelector('.dsh-mt_pw')
step('文案工作区渲染成功', !!pane)
if (!pane) return out
step('默认有三个模板', [...pane.querySelectorAll('.dsh-mt_pwTabs button')].filter((b) => !b.textContent.includes('新建')).length === 3)
const collapse = pane.querySelector('.dsh-mt_pwCollapse')
collapse?.click()
await sleep(100)
step('左侧栏可向左收起', pane.getAttribute('data-side-collapsed') === 'true' && pane.querySelector('.dsh-mt_pwSide').getBoundingClientRect().width <= 40)
collapse?.click()
await sleep(100)
step('左侧栏可重新展开', pane.getAttribute('data-side-collapsed') === 'false' && pane.querySelector('.dsh-mt_pwSide').getBoundingClientRect().width > 100)

const cardButtons = [...pane.querySelectorAll('.dsh-mt_pwCard button')]
cardButtons.find((b) => b.textContent.includes('添加限制文件'))?.click()
await sleep(100)
const constraint = pane.querySelector('.dsh-mt_pwConstraint')
setNative(constraint?.querySelector('input:not(.dsh-mt_pwNote)'), 'docs/PRD.md')
const select = constraint?.querySelector('select')
if (select) { select.value = 'read'; select.dispatchEvent(new Event('change', { bubbles: true })) }
setNative(constraint?.querySelector('.dsh-mt_pwNote'), '必须遵循这里的术语')

cardButtons.find((b) => b.textContent.includes('添加固定话语'))?.click()
await sleep(100)
const fixed = pane.querySelector('.dsh-mt_pwFixed textarea')
setNative(fixed, '完成后运行测试')
const need = pane.querySelector('.dsh-mt_pwNeed')
setNative(need, '实现导出功能')
await sleep(150)
const fill = [...pane.querySelectorAll('button')].find((b) => b.textContent.includes('填入当前聊天框'))
step('填入按钮可用', !!fill && !fill.disabled)
fill?.click()
await sleep(500)

const draft = window.__dshMytableRef?.readDraft?.() ?? ''
step('限制文件在固定话语前', draft.indexOf('【限制文件】') >= 0 && draft.indexOf('【限制文件】') < draft.indexOf('【固定要求】'), draft)
step('当前需求严格在末尾', draft.indexOf('【固定要求】') < draft.indexOf('【当前需求】') && draft.endsWith('实现导出功能'), draft)
step('只填草稿且当前需求框已清空', !!draft && pane.querySelector('.dsh-mt_pwNeed')?.value === '')
step('配置已保存到 localStorage', !!localStorage.getItem('dsh.mytable.promptWorkspaces.v1'))
return out
