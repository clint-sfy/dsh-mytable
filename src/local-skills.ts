import { lstat, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'

export type LocalSkillRoot = { id: string; label: string; path: string }
export type LocalSkillEntry = { id: string; name: string; description: string; source: string }
export type LocalSkillFile = { id: string; path: string; entry: boolean }

const MAX_SKILLS = 500
const MAX_FILES_PER_SKILL = 500
const MAX_SKILL_BYTES = 1024 * 1024
const MAX_DEPTH = 8
const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', '.cache'])

function within(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}

function skillId(rootId: string, relativeFile: string): string {
  return rootId + '.' + Buffer.from(relativeFile.split(sep).join('/'), 'utf8').toString('base64url')
}

function parseSkillId(id: string): { rootId: string; relativeFile: string } | null {
  if (typeof id !== 'string' || id.length > 4096) return null
  const match = /^([a-z0-9-]+)\.([A-Za-z0-9_-]+)$/.exec(id)
  if (!match) return null
  try {
    const encoded = match[2]
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8')
    if (!decoded || Buffer.from(decoded, 'utf8').toString('base64url') !== encoded) return null
    const parts = decoded.split('/')
    const fileName = parts.at(-1)?.toLowerCase() ?? ''
    if (!(fileName.endsWith('.md') || fileName.endsWith('.markdown')) || parts.some((part) => !part || part === '.' || part === '..' || part.includes('\\'))) return null
    return { rootId: match[1], relativeFile: parts.join(sep) }
  } catch {
    return null
  }
}

async function canonicalRoots(roots: readonly LocalSkillRoot[]): Promise<Map<string, { path: string; label: string }>> {
  const result = new Map<string, { path: string; label: string }>()
  for (const root of roots) {
    if (!/^[a-z0-9-]+$/.test(root.id) || result.has(root.id)) continue
    try {
      const canonical = await realpath(root.path)
      if (!(await stat(canonical)).isDirectory()) continue
      result.set(root.id, { path: canonical, label: root.label })
    } catch {
      // Skill folders are optional; a missing convention directory is simply omitted.
    }
  }
  return result
}

async function safeSkillFile(root: string, relativeFile: string): Promise<string | null> {
  const target = resolve(root, relativeFile)
  if (!within(root, target)) return null
  try {
    const info = await lstat(target)
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SKILL_BYTES) return null
    const canonical = await realpath(target)
    return within(root, canonical) ? canonical : null
  } catch {
    return null
  }
}

function frontmatterValue(text: string, key: string): string {
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!match) return ''
  const lines = match[1].split(/\r?\n/)
  const keyPattern = new RegExp('^\\s*' + key + '\\s*:\\s*(.*?)\\s*$')
  const index = lines.findIndex((line) => keyPattern.test(line))
  if (index < 0) return ''
  const value = keyPattern.exec(lines[index])?.[1]?.trim() ?? ''
  const block = /^([|>])[-+]?$/.exec(value)
  if (block) {
    const collected: string[] = []
    for (let i = index + 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim() && !/^\s/.test(line)) break
      collected.push(line.replace(/^\s+/, ''))
    }
    const result = block[1] === '>' ? collected.join(' ').replace(/\s+/g, ' ') : collected.join('\n')
    return result.trim()
  }
  return value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_all, double, single) => double ?? single ?? '').trim()
}

export async function listLocalSkills(roots: readonly LocalSkillRoot[]): Promise<LocalSkillEntry[]> {
  const canonical = await canonicalRoots(roots)
  const entries: LocalSkillEntry[] = []

  const walk = async (rootId: string, rootPath: string, dir: string, depth: number): Promise<void> => {
    if (entries.length >= MAX_SKILLS || depth > MAX_DEPTH) return
    let children
    try { children = await readdir(dir, { withFileTypes: true }) } catch { return }
    const skillFile = children.find((entry) => entry.name.toLowerCase() === 'skill.md' && entry.isFile())
    if (skillFile) {
      const relativeFile = relative(rootPath, resolve(dir, skillFile.name))
      const safeFile = await safeSkillFile(rootPath, relativeFile)
      if (safeFile) {
        try {
          const text = await readFile(safeFile, 'utf8')
          const folder = basename(dirname(safeFile))
          entries.push({
            id: skillId(rootId, relativeFile),
            name: frontmatterValue(text, 'name') || folder,
            description: frontmatterValue(text, 'description'),
            source: canonical.get(rootId)!.label,
          })
        } catch {}
      }
      return
    }
    for (const child of children) {
      if (entries.length >= MAX_SKILLS) break
      if (!child.isDirectory() || child.isSymbolicLink() || SKIP_DIRS.has(child.name.toLowerCase())) continue
      await walk(rootId, rootPath, resolve(dir, child.name), depth + 1)
    }
  }

  for (const [rootId, root] of canonical) {
    await walk(rootId, root.path, root.path, 0)
  }
  return entries.sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name))
}

/** 列出某个技能目录中的 Markdown 文件；只跟随目录本身，不跟随目录或文件符号链接。 */
export async function listLocalSkillFiles(roots: readonly LocalSkillRoot[], id: string): Promise<LocalSkillFile[] | null> {
  const parsed = parseSkillId(id)
  if (!parsed || basename(parsed.relativeFile).toLowerCase() !== 'skill.md') return null
  const canonical = await canonicalRoots(roots)
  const root = canonical.get(parsed.rootId)
  if (!root) return null
  const skillFile = await safeSkillFile(root.path, parsed.relativeFile)
  if (!skillFile) return null
  const skillDir = dirname(skillFile)
  const files: LocalSkillFile[] = []

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (files.length >= MAX_FILES_PER_SKILL || depth > 16) return
    let children
    try { children = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const child of children) {
      if (files.length >= MAX_FILES_PER_SKILL) break
      const childPath = resolve(dir, child.name)
      if (child.isDirectory() && !child.isSymbolicLink() && !SKIP_DIRS.has(child.name.toLowerCase())) {
        await walk(childPath, depth + 1)
        continue
      }
      if (!child.isFile() || !/\.(?:md|markdown)$/i.test(child.name)) continue
      const relativeFile = relative(root.path, childPath)
      const safeFile = await safeSkillFile(root.path, relativeFile)
      if (!safeFile) continue
      files.push({
        id: skillId(parsed.rootId, relativeFile),
        path: relative(skillDir, safeFile).split(sep).join('/'),
        entry: safeFile === skillFile,
      })
    }
  }

  await walk(skillDir, 0)
  return files.sort((a, b) => Number(b.entry) - Number(a.entry) || a.path.localeCompare(b.path))
}

async function belongsToSkill(root: string, relativeFile: string): Promise<boolean> {
  let dir = dirname(resolve(root, relativeFile))
  while (within(root, dir)) {
    let children
    try { children = await readdir(dir, { withFileTypes: true }) } catch { return false }
    const marker = children.find((entry) => entry.name.toLowerCase() === 'skill.md' && entry.isFile())
    if (marker && await safeSkillFile(root, relative(root, resolve(dir, marker.name)))) return true
    if (dir === root) break
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return false
}

async function resolveSkill(roots: readonly LocalSkillRoot[], id: string): Promise<{ path: string; id: string } | null> {
  const parsed = parseSkillId(id)
  if (!parsed) return null
  const canonical = await canonicalRoots(roots)
  const root = canonical.get(parsed.rootId)
  if (!root) return null
  const file = await safeSkillFile(root.path, parsed.relativeFile)
  if (!file || !await belongsToSkill(root.path, parsed.relativeFile)) return null
  return { path: file, id }
}

export async function readLocalSkill(roots: readonly LocalSkillRoot[], id: string): Promise<string | null> {
  const file = await resolveSkill(roots, id)
  if (!file) return null
  try { return await readFile(file.path, 'utf8') } catch { return null }
}

export async function writeLocalSkill(roots: readonly LocalSkillRoot[], id: string, content: unknown): Promise<boolean> {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_SKILL_BYTES) return false
  const file = await resolveSkill(roots, id)
  if (!file) return false
  try {
    await writeFile(file.path, content, 'utf8')
    return true
  } catch {
    return false
  }
}
