/**
 * 一次性迁移：把「改名之前」的浏览器状态从旧键搬到新键。
 *
 *   旧：localStorage `dsh.worktable.*`　·　IndexedDB `dsh-worktable`
 *   新：localStorage `dsh.mytable.*`　　·　IndexedDB `dsh-mytable`
 *
 * 规则：
 *   - 只跑一次：跑完（或确认没东西可搬）写标记 `dsh.mytable.migrated.v1`
 *   - 新键已有值 → 不覆盖（新数据优先，绝不冲掉改名后的操作）
 *   - 背景媒体库：旧库的照片记录整体复制进新库（新库非空则跳过）；真的搬进东西时补写
 *     `defaultBgSeeded.v1`，免得插件再往新库塞两张默认背景图
 *   - 旧键、旧库一律保留不删（可回退、可人工核对）
 *
 * 调用点：客户端 apply() 最开头。localStorage 部分是同步的（首屏读状态之前就位），
 * IndexedDB 部分异步后台进行、不阻塞首屏；任何异常都被吞掉——迁移失败不能拖垮插件。
 */

const OLD_LS_PREFIX = 'dsh.worktable.'
const NEW_LS_PREFIX = 'dsh.mytable.'
const MARK_KEY = 'dsh.mytable.migrated.v1'
const SEED_FLAG_KEY = 'dsh.mytable.defaultBgSeeded.v1'

const OLD_DB = 'dsh-worktable'
const NEW_DB = 'dsh-mytable'
const STORE = 'photoRecords'
const LEGACY_STORE = 'consoleBgPhoto'
const LEGACY_KEY = 'original'

export type LegacyMigrationReport = {
  /** 是否真的执行了（false = 之前已迁移过） */
  ran: boolean
  /** 从旧键复制过来的 localStorage 条数 */
  keys: number
  /** 被跳过的键（新键已有值） */
  kept: string[]
  /** IndexedDB 结果：'pending' 表示异步进行中 */
  idb: 'pending' | 'skipped' | 'empty' | 'copied' | 'failed'
}

const hasLS = (): boolean => {
  try { return typeof localStorage !== 'undefined' && localStorage !== null } catch { return false }
}

/** 旧键 → 新键逐条复制（新键有值则跳过）。返回复制条数与跳过清单。 */
function migrateLocalStorage(): { keys: number; kept: string[] } {
  const kept: string[] = []
  let copied = 0
  const moves: Array<[string, string]> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(OLD_LS_PREFIX)) continue
      moves.push([k, NEW_LS_PREFIX + k.slice(OLD_LS_PREFIX.length)])
    }
  } catch {
    return { keys: 0, kept }
  }
  for (const [oldKey, newKey] of moves) {
    try {
      const val = localStorage.getItem(oldKey)
      if (val === null) continue
      if (localStorage.getItem(newKey) !== null) { kept.push(oldKey); continue }
      localStorage.setItem(newKey, val)
      copied++
    } catch { /* 单条失败不影响其余 */ }
  }
  return { keys: copied, kept }
}

/** 旧库是否存在（优先用 indexedDB.databases()，不可用时按「打开即建」的代价试一次）。 */
async function oldDbExists(): Promise<boolean> {
  try {
    const anyIdb = indexedDB as unknown as { databases?: () => Promise<Array<{ name?: string }>> }
    if (typeof anyIdb.databases === 'function') {
      const list = await anyIdb.databases()
      return list.some((d) => d?.name === OLD_DB)
    }
  } catch { /* 落到下面的探测 */ }
  return true
}

function openOldDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(OLD_DB)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
}

function openNewDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NEW_DB, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 读一个 store 的全部原始值（不校验结构，原样搬运）。 */
function readAll(db: IDBDatabase, store: string): Promise<any[]> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(store)) { resolve([]); return }
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve((req.result as any[]) ?? [])
      req.onerror = () => resolve([])
    } catch { resolve([]) }
  })
}

function readOne(db: IDBDatabase, store: string, key: string): Promise<any | null> {
  return new Promise((resolve) => {
    try {
      if (!db.objectStoreNames.contains(store)) { resolve(null); return }
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

/** 把旧背景媒体库搬到新库（新库非空则跳过）。 */
async function migrateMedia(): Promise<'skipped' | 'empty' | 'copied' | 'failed'> {
  if (!(await oldDbExists())) return 'skipped'
  const old = await openOldDb()
  if (!old) return 'skipped'
  let records: any[] = []
  try {
    records = await readAll(old, STORE)
    if (records.length === 0) {
      // 旧的单图 store（v1）：转成一条 'legacy' 记录，与 photoStore 的惰性迁移同语义
      const blob = await readOne(old, LEGACY_STORE, LEGACY_KEY)
      if (blob) {
        const kind = typeof blob?.type === 'string' && blob.type.indexOf('video/') === 0 ? 'video' : 'photo'
        records = [{ id: 'legacy', createdAt: Date.now(), kind, blob }]
      }
    }
  } finally {
    try { old.close() } catch {}
  }
  if (records.length === 0) return 'empty'
  try {
    const db = await openNewDb()
    try {
      const cur = await readAll(db, STORE)
      if (cur.length > 0) return 'skipped' // 新库已有内容：不动
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        for (const r of records) {
          if (r && typeof r === 'object' && (r as any).blob) store.put(r, (r as any).id ?? 'legacy')
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
      // 真搬进来了：别再补默认背景图
      if (hasLS()) {
        try { localStorage.setItem(SEED_FLAG_KEY, '1') } catch {}
      }
      return 'copied'
    } finally {
      try { db.close() } catch {}
    }
  } catch {
    return 'failed'
  }
}

let done = false

/**
 * 执行一次性迁移（幂等；重复调用只跑第一次）。
 * @returns 本次迁移报告（indexedDB 部分异步，先返回 'pending'）
 */
export function runLegacyMigration(): LegacyMigrationReport {
  if (done) return { ran: false, keys: 0, kept: [], idb: 'skipped' }
  done = true
  if (!hasLS()) return { ran: false, keys: 0, kept: [], idb: 'skipped' }
  try {
    if (localStorage.getItem(MARK_KEY) !== null) return { ran: false, keys: 0, kept: [], idb: 'skipped' }
  } catch {
    return { ran: false, keys: 0, kept: [], idb: 'skipped' }
  }
  const { keys, kept } = migrateLocalStorage()
  // 标记在同步部分结束后立刻写：IndexedDB 部分走后台，重复加载不会重放（复制逻辑本身也幂等）
  try {
    localStorage.setItem(MARK_KEY, JSON.stringify({ at: Date.now(), keys, kept: kept.length }))
  } catch {}
  void migrateMedia().catch(() => {})
  return { ran: true, keys, kept, idb: 'pending' }
}

/** 供验收脚本调用：等 IndexedDB 部分结束（真实用户路径不需要，仅诊断用）。 */
export async function runLegacyMigrationAndWait(): Promise<LegacyMigrationReport> {
  const report = runLegacyMigration()
  if (!report.ran) return report
  return { ...report, idb: await migrateMedia().catch(() => 'failed' as const) }
}
