// 一次性迁移验收（分两阶段，两次独立导航）：
//   阶段 seed：往「旧键 / 旧库」写入可识别的数据（localStorage 键 + IndexedDB 照片记录 + 旧单图），
//              并清掉迁移标记，模拟「改名前的浏览器状态」
//   阶段 verify：重新加载页面（插件 apply() 跑迁移）→ 断言新键、新库、UI 都到位
// 用法（两次调用同一个脚本，靠 __probeArgs.phase 区分）：
//   node tests/cdp-probe.mjs <ws> <url> tests/verify-legacy-migration.js .tmp\shot.png fresh .tmp\args-seed.json
//   node tests/cdp-probe.mjs <ws> <url> tests/verify-legacy-migration.js .tmp\shot.png fresh .tmp\args-verify.json
const phase = __probeArgs.phase
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = { phase, steps: [], fail: false }
const step = (name, ok, detail) => { out.steps.push({ name, ok, detail }); if (!ok) out.fail = true }

const OLD = {
  view: 'dsh.worktable.view.v1',
  projects: 'dsh.worktable.projects.v1',
  settings: 'dsh.worktable.settings.v1',
  annot: 'dsh.worktable.annotHint.v1',
}
const NEW = {
  view: 'dsh.mytable.view.v1',
  projects: 'dsh.mytable.projects.v1',
  settings: 'dsh.mytable.settings.v1',
  annot: 'dsh.mytable.annotHint.v1',
}
const MARK = 'dsh.mytable.migrated.v1'
const SEED_FLAG = 'dsh.mytable.defaultBgSeeded.v1'
const OLD_DB = 'dsh-worktable'
const NEW_DB = 'dsh-mytable'
const STORE = 'photoRecords'

const idb = (name, version, upgrade) => new Promise((resolve, reject) => {
  const req = version ? indexedDB.open(name, version) : indexedDB.open(name)
  if (upgrade) req.onupgradeneeded = () => upgrade(req.result)
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})
const putAll = (db, store, rows) => new Promise((resolve, reject) => {
  const tx = db.transaction(store, 'readwrite')
  const os = tx.objectStore(store)
  for (const [k, v] of rows) os.put(v, k)
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(tx.error)
})
const getAll = (db, store) => new Promise((resolve) => {
  if (!db.objectStoreNames.contains(store)) { resolve([]); return }
  const tx = db.transaction(store, 'readonly')
  const req = tx.objectStore(store).getAll()
  req.onsuccess = () => resolve(req.result ?? [])
  req.onerror = () => resolve([])
})

const SEED_NAME = '迁移验证·快捷方式'

if (phase === 'seed') {
  // ① localStorage：视图（dock=float 让界面形态可见变化）+ 项目（含一张快捷方式卡片）
  localStorage.setItem(OLD.view, JSON.stringify({ dock: 'float', floatTop: 140, sortMigratedV2: true, consoleTheme: 'light' }))
  localStorage.setItem(OLD.projects, JSON.stringify({
    order: [], lastUsed: {}, hidden: [], nameOverrides: {}, iconOverrides: {}, removed: [], views: {},
    shortcuts: [{ id: 'mig-shortcut-1', name: SEED_NAME, href: 'https://example.com/mig', icon: '🧪' }],
    layouts: [], bindings: {}, folders: {},
  }))
  localStorage.setItem(OLD.settings, JSON.stringify({ panes: { terminal: false }, previews: { image: false } }))
  localStorage.setItem(OLD.annot, '1')
  // ② 清掉迁移标记与新键，回到「改名前的浏览器」
  localStorage.removeItem(MARK)
  localStorage.removeItem(SEED_FLAG)
  for (const k of Object.values(NEW)) localStorage.removeItem(k)
  // ③ IndexedDB：旧库写 2 条照片记录（含 Blob），旧单图 store 也放一张（验证兜底分支不炸）
  try { indexedDB.deleteDatabase(NEW_DB) } catch {}
  const old = await idb(OLD_DB, 2, (db) => {
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    if (!db.objectStoreNames.contains('consoleBgPhoto')) db.createObjectStore('consoleBgPhoto')
  })
  const mk = (txt, type) => new Blob([txt], { type })
  await putAll(old, STORE, [
    ['mig-a', { id: 'mig-a', createdAt: 1000, kind: 'photo', blob: mk('migrated-photo-A', 'image/png'), order: 0 }],
    ['mig-b', { id: 'mig-b', createdAt: 2000, kind: 'video', blob: mk('migrated-video-B', 'video/mp4'), order: 1 }],
  ])
  await putAll(old, 'consoleBgPhoto', [['original', mk('legacy-single', 'image/png')]])
  old.close()
  step('seed: legacy localStorage written', localStorage.getItem(OLD.projects) !== null, OLD.projects)
  step('seed: marker + new keys cleared', localStorage.getItem(MARK) === null && localStorage.getItem(NEW.projects) === null, null)
  step('seed: legacy IndexedDB written (2 records)', (await getAll(await idb(OLD_DB), STORE)).length === 2, null)
  return out
}

// ── verify 阶段：页面是「迁移后」的加载 ────────────────────────────────
await sleep(1500) // 给后台的 IndexedDB 迁移留时间

const ls = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const oldProjects = JSON.parse(ls(OLD.projects) || '{}')
const newProjects = JSON.parse(ls(NEW.projects) || 'null')
step('新键 projects.v1 已生成', newProjects !== null, ls(NEW.projects) ? '有值' : 'null')
step('快捷方式逐字搬过来（含名字/图标/链接）',
  !!newProjects?.shortcuts?.[0] && newProjects.shortcuts[0].name === SEED_NAME && newProjects.shortcuts[0].href === 'https://example.com/mig' && newProjects.shortcuts[0].icon === '🧪',
  JSON.stringify(newProjects?.shortcuts?.[0] ?? null))
step('旧键仍在（不删、可回退）', JSON.stringify(oldProjects).includes(SEED_NAME), OLD.projects)
step('视图键搬过来且内容一致', ls(NEW.view) === ls(OLD.view), ls(NEW.view))
step('偏好键搬过来（settings / annotHint）', ls(NEW.settings) === ls(OLD.settings) && ls(NEW.annot) === ls(OLD.annot), null)
step('迁移标记已写', ls(MARK) !== null, ls(MARK))
step('默认背景图旗标已置（不再塞两张默认图）', ls(SEED_FLAG) === '1', ls(SEED_FLAG))

const ndb = await idb(NEW_DB)
const rows = await getAll(ndb, STORE)
step('新背景库收到 2 条记录', rows.length === 2, 'got ' + rows.length)
const a = rows.find((r) => r && r.id === 'mig-a')
const b = rows.find((r) => r && r.id === 'mig-b')
step('照片 Blob 内容与类型完整', !!a && a.kind === 'photo' && a.blob instanceof Blob && (await a.blob.text()) === 'migrated-photo-A',
  a ? `${a.kind}/${a.blob?.type}` : 'missing')
step('视频 Blob 内容与类型完整', !!b && b.kind === 'video' && b.blob instanceof Blob && (await b.blob.text()) === 'migrated-video-B',
  b ? `${b.kind}/${b.blob?.type}` : 'missing')

// UI 侧：界面应读到迁移来的数据（dock=float → 浮层形态；快捷方式卡片出现在侧栏）
const floatNode = document.querySelector('.dsh-mt_float')
const bodyText = document.body ? document.body.innerText : ''
step('界面形态跟随迁移来的视图（dock=float）', !!floatNode, floatNode ? String(floatNode.className).slice(0, 40) : 'no .dsh-mt_float')
step('侧栏渲染出迁移来的快捷方式卡片', bodyText.includes(SEED_NAME), bodyText.includes(SEED_NAME) ? 'ok' : 'not found in body text')

return out
