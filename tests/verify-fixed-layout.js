// 固定布局规则验收：添加项目面板不再有布局选择；新项目 = 内容窗在左 + 聊天框右侧满高；无 ⇄ 翻转键
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }
const store = window.__dshWorktable && window.__dshWorktable.splitStore

// ── A. 侧栏「＋」面板里不再有布局选择 ─────────────────────────────────
const plusBtn = [...document.querySelectorAll('button')].find((b) => /添加项目/.test(b.getAttribute('aria-label') || '') || /添加项目/.test(b.getAttribute('title') || ''))
step('找到侧栏「＋ 添加项目」按钮', !!plusBtn, plusBtn ? plusBtn.getAttribute('aria-label') : null)
plusBtn && plusBtn.click()
await sleep(700)
const panel = document.querySelector('.dsh-mt_add')
step('添加项目面板已打开', !!panel, panel ? 'ok' : null)
if (panel) {
  out.panelText = (panel.textContent || '').replace(/\s+/g, ' ').slice(0, 120)
  step('面板里没有布局预设磁贴（.dsh-mt_presets 不存在）', !panel.querySelector('.dsh-mt_presets'), String(panel.querySelectorAll('.dsh-mt_presets').length))
  step('面板标题改为「新建项目」', /新建项目/.test(panel.textContent || ''), out.panelText)
  step('仍保留 名称 / 项目文件夹 / 保存 三件套', !!panel.querySelector('input') && !!panel.querySelector('.dsh-mt_addBtn'),
    `inputs=${panel.querySelectorAll('input').length}`)
  const backdrop = document.querySelector('.dsh-mt_popBackdrop')
  backdrop && backdrop.click()
  await sleep(400)
}

// ── B. 打开工作区：内容窗在左、聊天在右、聊天满高、无 ⇄ ──────────────
store.open({ id: 'probe-fixed', title: 'probe', top: null, main: [{ id: 'p1', title: '窗口1', min: 200, content: null }], chatWidth: { default: 360, min: 240, max: 600 }, chatSide: 'left', chatFullHeight: false })
await sleep(1600)
step('旧 spec（chatSide=left / chatFullHeight=false）被归一为规则布局',
  store.spec?.chatSide === 'right' && store.spec?.chatFullHeight === true,
  `chatSide=${store.spec?.chatSide} chatFullHeight=${store.spec?.chatFullHeight}`)
const paneR = document.querySelector('.dsh-mt_pane')?.getBoundingClientRect()
const g = store.geom
step('内容窗在左半区（右边界 < 几何中线偏右的聊天列起点）',
  !!paneR && !!g && paneR.right <= g.right - 300,
  paneR && g ? `pane.right=${Math.round(paneR.right)} geom.right=${g.right}` : 'no pane')
step('工具栏已无 ⇄ 聊天左右翻转键', !document.querySelector('.dsh-mt_splitFlip'), String(document.querySelectorAll('.dsh-mt_splitFlip').length))

// ── C. 向下分栏后仍保持「内容在左、聊天右侧满高」 ──────────────────────
const down = document.querySelector('[data-pane-action="split-down"]')
down && down.click()
await sleep(1000)
const rs = [...document.querySelectorAll('.dsh-mt_pane')].map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } })
out.rows = rs
step('向下分栏后两排都在左侧（两排同 x、同宽，未横跨聊天框）',
  rs.length === 2 && rs[0].x === rs[1].x && Math.abs(rs[0].w - rs[1].w) <= 4 && !!g && rs[0].w < (g.right - g.left),
  JSON.stringify(rs))
step('两排各占约一半高（聊天框右侧满高）', rs.length === 2 && Math.abs(rs[0].h - rs[1].h) <= Math.max(6, rs[0].h * 0.2), rs.map((r) => r.h).join('/'))
store.close()
await sleep(300)
return out
