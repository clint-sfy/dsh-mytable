// 设置节功能验收：注册/渲染/开关落盘 + 选择器过滤 + 文件预览门控（全部在真实宿主里跑）
// 用法：
//   node tests/cdp-probe.mjs <ws 模块路径> <就绪 URL> tests/verify-settings-section.js [截图] fresh "{\"png\":\"<绝对路径>.png\"}"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }

// ── 1. 打开 DSH 设置面板 ────────────────────────────────────────────────
const trigger = document.querySelector('[data-slot="sidebar.settings"] button')
step('settings trigger found', !!trigger, trigger ? String(trigger.className).slice(0, 40) : null)
if (!trigger) return out
trigger.click()
for (let i = 0; i < 40 && !document.body.textContent.includes('工作台'); i++) await sleep(250)
await sleep(900)

// ── 2. 导航里出现「工作台」节 ──────────────────────────────────────────
const navAll = [...document.querySelectorAll('button')].filter((b) => /工作台/.test(b.textContent || ''))
const nav = navAll.find((b) => !/dsh-mt_/.test(String(b.className)))
step('settings nav item 「工作台」', !!nav, nav ? String(nav.className).slice(0, 40) : JSON.stringify(navAll.map((b) => b.textContent.trim().slice(0, 14))))
if (!nav) return out
nav.click()
await sleep(900)

// ── 3. 节内容：两组 + 卡片清单 ────────────────────────────────────────
const body = document.querySelector('.dsh-mt_set')
step('section body rendered', !!body, body ? body.className : null)
if (!body) return out
const groups = [...body.querySelectorAll('.dsh-mt_setGroupTitle')].map((e) => e.textContent.trim())
const cards = [...body.querySelectorAll('.dsh-mt_setCard')].map((c) => ({
  name: c.querySelector('.dsh-mt_setName')?.textContent.trim() ?? '',
  desc: c.querySelector('.dsh-mt_setDesc')?.textContent.trim() ?? '',
  on: c.querySelector('.dsh-mt_setSwitch')?.getAttribute('aria-checked') === 'true',
}))
out.groups = groups
out.cards = cards
step('two groups (窗口类型 / 文件预览)', groups.length === 2, groups.join(' | '))
// 8 个窗口类型 + 11 个预览家族（html/md/code/text/image/pdf/audio/video/table/office/binary）
const EXPECTED_CARDS = 8 + 11
step(`${EXPECTED_CARDS} cards (8 panes + 11 previews)`, cards.length === EXPECTED_CARDS, String(cards.length))
for (const name of ['音频', '视频', '表格', 'Office 文档', '压缩包 / 二进制']) {
  step(`preview card: ${name}`, cards.some((c) => c.name === name), cards.map((c) => c.name).join(' / '))
}
step('all switches default on', cards.every((c) => c.on), cards.filter((c) => !c.on).map((c) => c.name).join(','))

const sw = (label) => [...body.querySelectorAll('.dsh-mt_setSwitch')].find((s) => s.getAttribute('aria-label') === label)
const readPrefs = () => { try { return JSON.parse(localStorage.getItem('dsh.mytable.settings.v1') || 'null') } catch { return null } }

// ── 4. 关掉「终端」→ 落盘 ─────────────────────────────────────────────
sw('终端')?.click()
await sleep(500)
const p1 = readPrefs()
step('terminal switch writes localStorage', p1?.panes?.terminal === false, JSON.stringify(p1?.panes))

// ── 5. 关掉设置面板，驱动分栏引擎开一个空窗格 ─────────────────────────
const closeBtn = [...document.querySelectorAll('button')].find((b) => /关闭|Close/.test(b.getAttribute('aria-label') || ''))
if (closeBtn) closeBtn.click()
await sleep(600)
const store = window.__dshWorktable && window.__dshWorktable.splitStore
step('splitStore debug hook', !!store, store ? 'window.__dshWorktable.splitStore' : null)
const picksOf = () => [...document.querySelectorAll('.dsh-mt_panePick')].map((b) => b.textContent.trim())
const hasTerm = (picks) => picks.some((p) => p.includes('终端'))
if (store) {
  store.open({ id: 'probe-layout', title: 'probe', top: null, main: [{ id: 'p1', title: '窗1', min: 120 }], chatWidth: { default: 420, min: 260, max: 900 } })
  await sleep(1500)
  const picks = picksOf()
  out.pickerAfterOff = picks
  // 选择器项数 = 8（浏览器/动画/资源管理器/文件变动/任务管理/文案工作区/终端/自定义），关掉终端后少一项
  step('picker hides 终端 when off', picks.length === 7 && !hasTerm(picks), picks.join(' / '))
}

// ── 6. 重新打开设置把「终端」打开 → 选择器应实时回来（无需重开窗口）──
trigger.click()
await sleep(700)
const nav2 = [...document.querySelectorAll('button')].find((b) => /工作台/.test(b.textContent || '') && !/dsh-mt_/.test(String(b.className)))
nav2?.click()
await sleep(700)
const body2 = document.querySelector('.dsh-mt_set')
const swTerm = body2 && [...body2.querySelectorAll('.dsh-mt_setSwitch')].find((s) => s.getAttribute('aria-label') === '终端')
swTerm?.click()
await sleep(700)
const picksBack = picksOf()
out.pickerAfterOn = picksBack
step('picker shows 终端 again (live, no reopen)', picksBack.length === 8 && hasTerm(picksBack), picksBack.join(' / '))

// ── 7. 图片预览开关 → 窗格里放一张真图 ───────────────────────────────
const swImg = body2 && [...body2.querySelectorAll('.dsh-mt_setSwitch')].find((s) => s.getAttribute('aria-label') === '图片')
swImg?.click()
await sleep(500)
step('image preview switch writes localStorage', readPrefs()?.previews?.image === false, JSON.stringify(readPrefs()?.previews))
const closeBtn2 = [...document.querySelectorAll('button')].find((b) => /关闭|Close/.test(b.getAttribute('aria-label') || ''))
if (closeBtn2) closeBtn2.click()
await sleep(500)
const png = __probeArgs.png || 'C:\\MyProject\\deepseek\\work_table\\dsh-mytable\\.tmp\\mytable.png'
if (store) {
  store.setPaneContent('main', 0, { kind: 'file', path: png })
  await sleep(1500)
  const txtOff = document.querySelector('.dsh-mt_paneWipText')?.textContent || ''
  const imgsOff = document.querySelectorAll('.dsh-mt_imgView img').length
  out.previewOff = { notice: txtOff.slice(0, 60), imgs: imgsOff }
  step('image preview off shows notice (no <img>)', imgsOff === 0 && /关闭/.test(txtOff), JSON.stringify(out.previewOff))
}

// ── 8. 打开图片预览 → 同一窗格应直接渲染出 <img> ──────────────────────
trigger.click()
await sleep(700)
const nav3 = [...document.querySelectorAll('button')].find((b) => /工作台/.test(b.textContent || '') && !/dsh-mt_/.test(String(b.className)))
nav3?.click()
await sleep(700)
const body3 = document.querySelector('.dsh-mt_set')
const swImg2 = body3 && [...body3.querySelectorAll('.dsh-mt_setSwitch')].find((s) => s.getAttribute('aria-label') === '图片')
swImg2?.click()
await sleep(1200)
const imgsOn = document.querySelectorAll('.dsh-mt_imgView img').length
out.previewOn = { imgs: imgsOn }
step('image preview on renders <img> (live)', imgsOn === 1, JSON.stringify(out.previewOn))

// ── 9. 收尾：恢复全开，关闭探测布局 ──────────────────────────────────
if (store) { store.close(); await sleep(400) }
const closeBtn3 = [...document.querySelectorAll('button')].find((b) => /关闭|Close/.test(b.getAttribute('aria-label') || ''))
if (closeBtn3) closeBtn3.click()
out.finalPrefs = readPrefs()
step('prefs restored (all on)', out.finalPrefs?.previews?.image === true && out.finalPrefs?.panes?.terminal === true, JSON.stringify(out.finalPrefs))

return out
