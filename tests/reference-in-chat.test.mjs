/**
 * `@` 引用与路径折叠的纯逻辑回归（不碰 DOM、不碰宿主服务）。
 * 用法：node tests/reference-in-chat.test.mjs
 *
 * 直接打靶源码 `src/client/reference-in-chat.ts`（Node 24 原生类型剥离）——该模块的
 * 纯函数部分（DSH 的 `@file` 拼写、按光标切插、相对路径折算）是资源管理器 `@` 胶囊与预览头
 * `@` 按钮共用的规则，改坏会直接影响「能不能把文件 @ 进对话」。
 *
 * 覆盖点：
 *   A. fileMention：裸写 / 含空格加引号 / 控制字符与引号拒绝 / label 取 basename
 *   B. insertAtCaret：空草稿 / 末尾追加 / 中间插入补单空格 / 贴边与已空白不重复补 / 选区替换
 *   C. relativeTo：cwd 之下折相对 / 大小写不敏感 / cwd 之外退化为去前导分隔符 / 反斜杠归一
 */
import { fileMention, insertAtCaret } from '../src/client/reference-in-chat.ts'
import { relativeTo } from '../src/client/pathutil.ts'

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

// ── A. @file 拼写 ─────────────────────────────────────────────────────────────
eq('A1 无空白：裸写 @ + 相对路径', fileMention('src/a.ts').mention, '@src/a.ts')
eq('A2 取 basename 作胶囊标签', fileMention('src/deep/a.ts').label, 'a.ts')
eq('A3 含空格：整体加引号', fileMention('my dir/a b.ts').mention, '@"my dir/a b.ts"')
eq('A4 含空格时标签仍是文件名', fileMention('my dir/a b.ts').label, 'a b.ts')
eq('A5 末尾分隔符先剥掉', fileMention('src/dir/').mention, '@src/dir')
eq('A6 控制字符 → 放弃结构化插入', fileMention('src/a\u0001b.ts'), undefined)
eq('A7 内嵌引号 → 放弃（编辑器语法表达不了）', fileMention('src/a"b.ts'), undefined)
eq('A8 反斜杠路径的标签取最后一段', fileMention('src\\win\\b.ts').label, 'b.ts')

// ── B. 按光标切插 ─────────────────────────────────────────────────────────────
eq('B1 空草稿 → 就插内容本身', insertAtCaret('', '@a.ts', null), '@a.ts')
eq('B2 光标未知 → 末尾追加并补一个空格', insertAtCaret('hi', '@a.ts', null), 'hi @a.ts')
eq('B3 纯空白草稿 → 不补空格', insertAtCaret('   ', '@a.ts', null), '@a.ts')
eq('B4 光标在末尾 → 补一个空格后追加', insertAtCaret('hi', '@a.ts', { start: 2, end: 2 }), 'hi @a.ts')
eq('B5 光标在中间 → 左右各补一个空格', insertAtCaret('aB', '@x', { start: 1, end: 1 }), 'a @x B')
eq('B6 左侧已是空白 → 不重复补', insertAtCaret('a B', '@x', { start: 2, end: 2 }), 'a @x B')
eq('B7 有选区 → 选区被替换', insertAtCaret('aXXXb', '@x', { start: 1, end: 4 }), 'a @x b')
eq('B8 空草稿 + 有光标 → 就是内容', insertAtCaret('', '@x', { start: 0, end: 0 }), '@x')

// ── C. 相对路径折算 ───────────────────────────────────────────────────────────
eq('C1 cwd 之下 → 去掉前缀', relativeTo('C:\\w\\proj', 'C:\\w\\proj\\src\\a.ts'), 'src/a.ts')
eq('C2 大小写不敏感（Windows）', relativeTo('c:\\W\\Proj', 'C:\\w\\proj\\a.ts'), 'a.ts')
eq('C3 正斜杠 cwd 也认', relativeTo('C:/w/proj', 'C:\\w\\proj\\a.ts'), 'a.ts')
eq('C4 cwd 自己 → .', relativeTo('C:\\w\\proj', 'C:\\w\\proj\\'), '.')
eq('C5 cwd 之外 → 去掉前导分隔符的原路径', relativeTo('C:\\w\\proj', 'D:\\other\\a.ts'), 'D:/other/a.ts')
eq('C6 空 cwd → 原路径去前导斜杠', relativeTo('', '/tmp/a.ts'), 'tmp/a.ts')
eq('C7 前缀相同但不是同级（proj2）→ 不误折', relativeTo('C:\\w\\proj', 'C:\\w\\proj2\\a.ts'), 'C:/w/proj2/a.ts')

console.log(`\n${pass} passed, ${failures.length} failed`)
for (const f of failures) console.error('  - ' + f)
process.exitCode = failures.length === 0 ? 0 : 1
