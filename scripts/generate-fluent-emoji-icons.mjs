import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const sourcePath = resolve('node_modules/@iconify-json/fluent-emoji-flat/icons.json')
const outputPath = resolve('src/client/fluent-emoji-icons.generated.ts')
const collection = JSON.parse(readFileSync(sourcePath, 'utf8'))

const names = {
  worktable: 'desktop-computer', monitor: 'desktop-computer', brick: 'brick', laptop: 'laptop',
  keyboard: 'keyboard', developer: 'technologist', robot: 'robot', tools: 'hammer-and-wrench',
  settings: 'gear', wrench: 'wrench', package: 'package', folders: 'open-file-folder', folder: 'file-folder',
  note: 'memo', books: 'books', pencil: 'pencil', ruler: 'triangular-ruler', flask: 'test-tube',
  microscope: 'microscope', chart: 'bar-chart', compass: 'compass', rocket: 'rocket',
  globe: 'globe-with-meridians', lock: 'locked', sparkles: 'sparkles', chat: 'speech-balloon',
  palette: 'artist-palette', game: 'video-game', home: 'house', school: 'graduation-cap',
  car: 'automobile', plane: 'airplane', world: 'globe-showing-europe-africa',
  hospital: 'hospital', target: 'bullseye', bulb: 'light-bulb', link: 'link',
  atom: 'atom-symbol', dna: 'dna', brain: 'brain', scientist: 'scientist',
  labcoat: 'lab-coat', telescope: 'telescope', satellite: 'satellite', antenna: 'satellite-antenna',
  abacus: 'abacus', disk: 'computer-disk', mouse: 'computer-mouse', search: 'magnifying-glass-tilted-left',
}

const icons = Object.fromEntries(Object.entries(names).map(([glyph, name]) => {
  const icon = collection.icons[name]
  if (!icon) throw new Error(`Missing Fluent Emoji icon: ${name}`)
  return [glyph, { body: icon.body, width: icon.width ?? collection.width ?? 32, height: icon.height ?? collection.height ?? 32 }]
}))

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `/** Generated from @iconify-json/fluent-emoji-flat (Microsoft Fluent Emoji, MIT). */\nexport const FLUENT_EMOJI_ICONS = ${JSON.stringify(icons)} as const\n`)
