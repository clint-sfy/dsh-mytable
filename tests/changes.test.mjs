/**
 * 「文件变动」两个镜头的纯逻辑单测（不碰 DOM）：
 *   - `diff-parse.ts`：unified diff 解析（多文件 / 多 hunk / 新增 / 删除 / 重命名 / 二进制 /
 *     无尾换行）、行号、配对、行内字符级区间
 *   - `session-ops.ts`：会话事件折叠成文件操作（读/写/改/失败/进行中/无关工具）、按文件分组、
 *     上一次已知内容反推、read 结果解析、会话镜头的行级 diff
 *
 * 用法：node tests/changes.test.mjs
 */
import { collectPairs, countChanges, diffInline, diffLayout, parseUnifiedDiff, sliceLines } from '../src/client/diff-parse.ts'
import { entriesOf, statusKind, totalsOf } from '../src/client/git-model.ts'
import {
  extractFileOps, groupByFile, knownContentBefore, lineDiff, opCounts,
  parseReadContent, parseReadLines, previewSides, bytesOf, formatBytes, relativeLabel, mergeEvents, OPS_EVENTS_CAP,
} from '../src/client/session-ops.ts'

let pass = 0
const failures = []
const ok = (name) => { console.log('ok   ' + name); pass++ }
function fail(name, detail) {
  failures.push(name + ': ' + detail)
  console.error('FAIL(' + name + '): ' + detail)
}
function eq(name, actual, expected) {
  if (actual === expected) ok(name)
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

// ── A. unified diff 解析 ────────────────────────────────────────────────────
const ONE = [
  'diff --git a/src/a.ts b/src/a.ts',
  'index 1111111..2222222 100644',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,4 +1,4 @@',
  ' const x = 1',
  '-const y = 2',
  '+const y = 3',
  ' const z = 4',
].join('\n')
const a = parseUnifiedDiff(ONE)
eq('A1 单文件解析出一个文件', a.length, 1)
eq('A2 相对路径取 b/ 侧', a[0].rel, 'src/a.ts')
eq('A3 一个 hunk', a[0].hunks.length, 1)
eq('A4 增删行数', `${a[0].additions}/${a[0].deletions}`, '1/1')
eq('A5 hunk 行数（含上下文）', a[0].hunks[0].rows.length, 4)
eq('A6 行号：上下文行两侧都有', `${a[0].hunks[0].rows[0].oldLine}/${a[0].hunks[0].rows[0].newLine}`, '1/1')
eq('A7 删除行只有旧行号', `${a[0].hunks[0].rows[1].oldLine}/${a[0].hunks[0].rows[1].newLine}`, '2/undefined')
eq('A8 新增行只有新行号', `${a[0].hunks[0].rows[2].oldLine}/${a[0].hunks[0].rows[2].newLine}`, 'undefined/2')
eq('A9 删/增配对共享 pairId', String(a[0].hunks[0].rows[1].pairId === a[0].hunks[0].rows[2].pairId), 'true')
const pairs = collectPairs(a)
eq('A10 配对的旧/新文本拿到', JSON.stringify(pairs.get(1)), JSON.stringify({ old: 'const y = 2', next: 'const y = 3' }))

const TWO_HUNKS = [
  'diff --git a/f.txt b/f.txt',
  '--- a/f.txt',
  '+++ b/f.txt',
  '@@ -1,2 +1,2 @@',
  '-a',
  '+A',
  ' b',
  '@@ -10,2 +10,3 @@',
  ' j',
  '+k',
  ' l',
].join('\n')
const b = parseUnifiedDiff(TWO_HUNKS)
eq('A11 两个 hunk', b[0].hunks.length, 2)
eq('A12 第二个 hunk 的起始行号', `${b[0].hunks[1].oldStart}/${b[0].hunks[1].newStart}`, '10/10')
eq('A13 第二个 hunk 行号接着 hunk 头走', String(b[0].hunks[1].rows[0].oldLine), '10')
eq('A14 汇总增删', `${b[0].additions}/${b[0].deletions}`, '2/1')

const NEW_FILE = [
  'diff --git a/new.ts b/new.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/new.ts',
  '@@ -0,0 +1,2 @@',
  '+line1',
  '+line2',
].join('\n')
const c = parseUnifiedDiff(NEW_FILE)
eq('A15 新增文件：oldPath 是 /dev/null', c[0].oldPath, '/dev/null')
eq('A16 新增文件：全是新增', `${c[0].additions}/${c[0].deletions}`, '2/0')
eq('A17 新增文件：0 起始的 hunk 不产生旧行号', String(c[0].hunks[0].rows[0].oldLine), 'undefined')

const DELETED = [
  'diff --git a/gone.ts b/gone.ts',
  'deleted file mode 100644',
  '--- a/gone.ts',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
  '-x',
  '-y',
].join('\n')
const d = parseUnifiedDiff(DELETED)
eq('A18 删除文件：全是删除', `${d[0].additions}/${d[0].deletions}`, '0/2')
eq('A19 删除文件：新路径是 /dev/null', d[0].newPath, '/dev/null')

const RENAME = ['diff --git a/old.ts b/new.ts', 'similarity index 100%', 'rename from old.ts', 'rename to new.ts'].join('\n')
const e = parseUnifiedDiff(RENAME)
eq('A20 纯重命名：无 hunk', e[0].hunks.length, 0)
eq('A21 纯重命名：元信息保留', e[0].meta.some((m) => m.includes('rename from')), true)
eq('A22 纯重命名：rel 取新名', e[0].rel, 'new.ts')

const MULTI = `${ONE}\n${TWO_HUNKS}`
eq('A23 多文件 diff 切成两段', parseUnifiedDiff(MULTI).length, 2)
eq('A24 汇总函数', JSON.stringify(countChanges(parseUnifiedDiff(MULTI))), JSON.stringify({ additions: 3, deletions: 2 }))

const NO_NEWLINE = [
  'diff --git a/n.txt b/n.txt',
  '--- a/n.txt',
  '+++ b/n.txt',
  '@@ -1 +1 @@',
  '-old',
  '\\ No newline at end of file',
  '+new',
  '\\ No newline at end of file',
].join('\n')
const f = parseUnifiedDiff(NO_NEWLINE)
eq('A25 无尾换行标记归为 meta 行', f[0].hunks[0].rows.filter((r) => r.kind === 'meta').length, 2)
eq('A26 meta 行不影响增删计数', `${f[0].additions}/${f[0].deletions}`, '1/1')

const BIN = ['diff --git a/x.png b/x.png', 'index 111..222 100644', 'Binary files a/x.png and b/x.png differ'].join('\n')
eq('A27 二进制 diff 被识别', parseUnifiedDiff(BIN)[0].binary, true)

// ── B. 行内字符级区间 ───────────────────────────────────────────────────────
eq('B1 相同行没有改动区间', JSON.stringify(diffInline('abc', 'abc')), JSON.stringify({ old: null, next: null }))
const di = diffInline('const y = 2', 'const y = 3')
eq('B2 只框住变掉的字符', JSON.stringify(di.old) + JSON.stringify(di.next), JSON.stringify({ from: 10, to: 11 }) + JSON.stringify({ from: 10, to: 11 }))
eq('B3 纯追加：旧侧无区间', JSON.stringify(diffInline('ab', 'abc').old), 'null')
eq('B4 纯删除：新侧无区间', JSON.stringify(diffInline('abc', 'ab').next), 'null')
eq('B5 整行不同：区间覆盖整行', JSON.stringify(diffInline('aaa', 'bbb')), JSON.stringify({ old: { from: 0, to: 3 }, next: { from: 0, to: 3 } }))

// ── C. 会话事件折叠 ─────────────────────────────────────────────────────────
const call = (seq, name, callId, args, time = seq * 1000) => ({
  seq, time, type: 'tool/call', data: { name, callId, arguments: JSON.stringify(args) },
})
const result = (seq, callId, text, isError = false, time = seq * 1000) => ({
  seq, time, type: 'tool/result',
  data: { message: { source: { callId }, content: [{ type: 'tool-result', isError, content: [{ type: 'text', text }] }] } },
})
const EVENTS = [
  call(1, 'read', 'c1', { file_path: 'src/a.ts' }),
  result(2, 'c1', '<content>1: const a = 1\n2: const b = 2</content>'),
  call(3, 'write', 'c2', { file_path: 'src/new.ts', content: 'hello\nworld' }),
  result(4, 'c2', '已写入 11 字节'),
  call(5, 'edit', 'c3', { file_path: 'src/a.ts', old_string: 'const a = 1', new_string: 'const a = 42' }),
  result(6, 'c3', '已替换 1 处'),
  call(7, 'edit', 'c4', { file_path: 'src/bad.ts', old_string: 'x', new_string: 'y' }),
  result(8, 'c4', 'Error: file not found', true),
  call(9, 'edit', 'c5', { file_path: 'src/pending.ts', old_string: 'p', new_string: 'q' }),
  call(10, 'bash', 'c6', { command: 'ls' }),
  call(11, 'read', 'c7', {}),
]
const ops = extractFileOps(EVENTS)
eq('C1 只保留碰文件的工具（bash/无路径的忽略）', ops.length, 5, )
eq('C2 最新在前（c7 无路径被忽略 → 取 c5）', ops[0].callId, 'c5')
const byId = new Map(ops.map((o) => [o.callId, o]))
eq('C3 read 结算：拿到结果正文', byId.get('c1').read.includes('const a = 1'), true)
eq('C4 read 不再 running', byId.get('c1').running, false)
eq('C5 write：载荷来自调用参数', byId.get('c2').content, 'hello\nworld')
eq('C6 write 结果摘要进 note', byId.get('c2').note, '已写入 11 字节')
eq('C7 edit：old/new 都记下来', `${byId.get('c3').edit.oldString}→${byId.get('c3').edit.newString}`, 'const a = 1→const a = 42')
eq('C8 失败：isError + 报错文本', `${byId.get('c4').isError}|${byId.get('c4').errorText}`, 'true|Error: file not found')
eq('C9 没有结果的调用标为进行中', byId.get('c5').running, true)
eq('C10 计数汇总（无路径的 read 不计）', JSON.stringify(opCounts(ops)), JSON.stringify({ read: 1, write: 1, edit: 3 }))

const groups = groupByFile(ops)
eq('C11 按文件分组：src/a.ts 有 2 条', groups.get('src/a.ts').length, 2)
eq('C12 组间按最近一次操作排序（pending 最近）', [...groups.keys()][0], 'src/pending.ts')
eq('C13 该文件在本会话里第一次被写：没有更早内容', knownContentBefore(ops, 'src/new.ts', byId.get('c2')), undefined)
eq('C14 上一次已知内容：从更早的 read 结果反推', knownContentBefore(ops, 'src/a.ts', byId.get('c3')), 'const a = 1\nconst b = 2')

eq('C15 read 结果解析出行号', JSON.stringify(parseReadLines('<content>1: a\n2: b</content>')), JSON.stringify([{ line: 1, text: 'a' }, { line: 2, text: 'b' }]))
eq('C16 read 结果去掉旁注行', parseReadLines('<content>1: a\n(Showing lines 1-1 of 9)</content>').length, 1)
eq('C17 read 正文保留空行、去前缀', JSON.stringify(parseReadContent('<content>1: a\n2: \n3: b</content>')), JSON.stringify('a\n\nb'))
eq('C18 预览两侧：write 与 edit', JSON.stringify(previewSides(byId.get('c3'), ops)), JSON.stringify({ before: 'const a = 1', after: 'const a = 42' }))

// ── D. 会话镜头的行级 diff ──────────────────────────────────────────────────
const rows = lineDiff('a\nb\nc', 'a\nB\nc')
eq('D1 公共前后缀被掐掉：头尾各一行上下文 + 删 + 增', rows.length, 4)
eq('D2 中间是删 + 增', `${rows[1].kind}${rows[2].kind}`, 'deladd')
eq('D3 配对标记让行内高亮可用', String(rows[1].pairId === rows[2].pairId), 'true')
eq('D4 行号正确', `${rows[0].oldLine}/${rows[1].oldLine}/${rows[2].newLine}`, '1/2/2')
eq('D5 从空到有内容：整份新增', lineDiff('', 'x\ny').filter((r) => r.kind === 'add').length, 2)
eq('D6 两侧相同：没有增删行', lineDiff('same', 'same').filter((r) => r.kind !== 'ctx').length, 0)
eq('D7 只删不增', lineDiff('a\nb', 'a').filter((r) => r.kind === 'del').length, 1)

// ── E. Git 文件模型（git-model.ts）───────────────────────────────────────────
eq('E1 ?? 是未跟踪', statusKind('??'), 'new')
eq('E2 " M" 是工作区修改', statusKind(' M'), 'modified')
eq('E3 "M " 是索引里已修改', statusKind('M '), 'modified')
eq('E4 "A " 是新增', statusKind('A '), 'added')
eq('E5 " D" 是删除', statusKind(' D'), 'deleted')
eq('E6 "R " 是重命名', statusKind('R '), 'renamed')
const gitFiles = [
  { path: '/r/a.ts', rel: 'a.ts', status: ' M', untracked: false, unstaged: { diff: 'd1', additions: 1, deletions: 1 } },
  { path: '/r/b.ts', rel: 'b.ts', status: 'MM', untracked: false, staged: { diff: 'd2', additions: 2, deletions: 0 }, unstaged: { diff: 'd3', additions: 1, deletions: 1 } },
  { path: '/r/c.txt', rel: 'c.txt', status: '??', untracked: true, unstaged: { diff: 'd4', additions: 3, deletions: 0 } },
  { path: '/r/bin.dat', rel: 'bin.dat', status: ' M', untracked: false },
]
const list = entriesOf(gitFiles)
eq('E7 摊平：已暂存 1 项 + 未暂存 4 项（含两侧都有的 b.ts）', list.length, 5)
eq('E8 已暂存排在前面', list[0].side, 'staged')
eq('E9 两侧都有的文件各有独立 key', `${list[0].key}|${list[1].key}`, 'b.ts:staged|a.ts:unstaged')
eq('E10 没过 diff 的文件也列出来（key 标记 none）', list.some((e) => e.key === 'bin.dat:none'), true)
eq('E11 同侧按路径排序', list.filter((e) => e.side === 'unstaged').map((e) => e.file.rel).join(','), 'a.ts,b.ts,bin.dat,c.txt')
eq('E12 增删合计', JSON.stringify(totalsOf(gitFiles)), JSON.stringify({ additions: 7, deletions: 2 }))

// ── F. diff 排版：未改动区间 ────────────────────────────────────────────────
const GAPPED = parseUnifiedDiff([
  'diff --git a/g.txt b/g.txt',
  '--- a/g.txt',
  '+++ b/g.txt',
  '@@ -3,3 +3,3 @@',
  ' ctx1',
  '-old',
  '+new',
  ' ctx2',
  '@@ -40,2 +40,2 @@',
  '-tail',
  '+tail2',
  ' end',
].join('\n'))
const layout2 = diffLayout(GAPPED[0])
eq('F1 两个 hunk 的行下标', JSON.stringify(layout2.hunkRowIndex), JSON.stringify([0, 4]))
eq('F2 文件开头到第一个 hunk 之间是 gap（1-2 行）', JSON.stringify(layout2.gaps.get(0)), JSON.stringify({ oldStart: 1, newStart: 1, count: 2 }))
eq('F3 两个 hunk 之间的 gap（6-39 行）', JSON.stringify(layout2.gaps.get(4)), JSON.stringify({ oldStart: 6, newStart: 6, count: 34 }))
eq('F4 没有 gap 时不产生条目', diffLayout(parseUnifiedDiff(['diff --git a/h b/h', '--- a/h', '+++ b/h', '@@ -1,2 +1,2 @@', '-a', '+b', ' c'].join('\n'))[0]).gaps.size, 0)
const fileText = ['L1', 'L2', 'L3', 'L4', 'L5'].join('\n')
eq('F5 按行号取一段（1 基）', JSON.stringify(sliceLines(fileText, 2, 2)), JSON.stringify(['L2', 'L3']))
eq('F6 超出范围只取到末尾', JSON.stringify(sliceLines(fileText, 4, 9)), JSON.stringify(['L4', 'L5']))

// ── G. 会话镜头新增的展示辅助 ───────────────────────────────────────────────
eq('G1 formatBytes：B', formatBytes(512), '512 B')
eq('G2 formatBytes：KB', formatBytes(2048), '2.0 KB')
eq('G3 formatBytes：MB', formatBytes(3 * 1024 * 1024), '3.0 MB')
eq('G4 formatBytes：0 / 负数返回空串', formatBytes(0) + '|' + formatBytes(-1), '|')
eq('G5 bytesOf：write 按内容长度', bytesOf({ callId: 'x', kind: 'write', path: 'a', time: 0, running: false, isError: false, content: 'abc' }), 3)
eq('G6 bytesOf：edit 是两侧之和', bytesOf({ callId: 'x', kind: 'edit', path: 'a', time: 0, running: false, isError: false, edit: { oldString: 'ab', newString: 'cde' } }), 5)
eq('G7 bytesOf：read 结果', bytesOf({ callId: 'x', kind: 'read', path: 'a', time: 0, running: false, isError: false, read: '12345' }), 5)
const now = 1_700_000_000_000
eq('G8 相对时间：刚刚', JSON.stringify(relativeLabel(now - 5_000, now)), JSON.stringify({ key: 'justNow', n: 0 }))
eq('G9 相对时间：分钟', JSON.stringify(relativeLabel(now - 5 * 60_000, now)), JSON.stringify({ key: 'minutes', n: 5 }))
eq('G10 相对时间：小时', JSON.stringify(relativeLabel(now - 3 * 3600_000, now)), JSON.stringify({ key: 'hours', n: 3 }))
eq('G11 相对时间：天', JSON.stringify(relativeLabel(now - 2 * 86400_000, now)), JSON.stringify({ key: 'days', n: 2 }))
const ev = (seq) => ({ seq, type: 'tool/call', time: seq, data: { name: 'read', callId: 'c' + seq, arguments: '{}' } })
eq('G12 mergeEvents：按 seq 去重保序', mergeEvents([ev(2), ev(3)], [ev(3), ev(4)]).map((e) => e.seq).join(','), '2,3,4')
eq('G13 mergeEvents：空增量原样返回', mergeEvents([ev(1)], []).length, 1)
const many = Array.from({ length: OPS_EVENTS_CAP + 50 }, (_, i) => ev(i + 1))
const mergedMany = mergeEvents(many, [ev(OPS_EVENTS_CAP + 51)])
eq('G14 mergeEvents：超过上限只留最近的', mergedMany.length, OPS_EVENTS_CAP)
eq('G15 mergeEvents：留下的确实是最新那段', mergedMany[mergedMany.length - 1].seq, OPS_EVENTS_CAP + 51)

console.log(`\n${pass} passed, ${failures.length} failed`)
for (const f2 of failures) console.error('  - ' + f2)
process.exitCode = failures.length === 0 ? 0 : 1
