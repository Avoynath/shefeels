/*
  assets.ts
  Helper to load images from the project's `assets/` folder using Vite's import.meta.glob.
  Exports a small API to query assets by category (girl | men) and optional sub-folder.

  Notes:
  - Uses `import.meta.glob` with `query: '?url'` and `eager: true` so modules are resolved to URL strings at build time.
  - Path used is relative to this file: '../../../assets' -> points to frontend/assets
*/

export type AssetItem = {
  id: string // category/folder/filename
  name: string // human-friendly name
  url: string  // final URL usable in <img src={url} />
  category: 'female' | 'male'
  folder: string // sub-folder under category, e.g. 'hair-style', 'ethnicity', 'character'
}

type ModulesMap = Record<string, string>

// Accepts a category input (legacy or canonical) and loads modules from the matching folder.
function loadModulesForCategory(categoryInput: string): ModulesMap {
  // Map legacy names to canonical folder names used on disk
  const mapToFolder = (s: string) => {
    const low = String(s || '').toLowerCase()
    if (['girl', 'girls', 'female', 'woman', 'women'].includes(low)) return 'female'
    if (['men', 'man', 'male', 'guys'].includes(low)) return 'male'
    return low
  }

  const category = mapToFolder(categoryInput)

  // Path is relative to this file (admin/src/utils) -> '../../../assets/<category>'
  // We cast import.meta to any to avoid TS complaining about Vite-specific signatures.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const glob = (import.meta as any).glob;
  if (!glob) return {}

  const pattern = `../../../assets/${category}/**/*.{png,jpg,jpeg,svg}`
  // eager + query:'?url' + import:'default' returns a record filePath -> url string (new Vite syntax)
  const modules: ModulesMap = glob(pattern, { eager: true, query: '?url', import: 'default' }) as ModulesMap
  return modules
}

function buildItemsFromModules(mods: ModulesMap): AssetItem[] {
  return Object.entries(mods)
    .map(([filePath, url]) => {
      // filePath example: '../../../assets/female/hair-style/bangs.png' OR '../../../assets/female/...'
      const parts = filePath.split(/[\\/]+/g)
      // find a category part that looks like girl/men/female/male and normalize to female|male
      const catIndex = parts.findIndex(p => {
        const lp = String(p).toLowerCase()
        return ['girl', 'girls', 'female', 'woman', 'women', 'men', 'male', 'man', 'guys'].includes(lp)
      })

      const rawCategory = catIndex >= 0 ? String(parts[catIndex]).toLowerCase() : 'unknown'
      const category = ['girl', 'girls', 'female', 'woman', 'women'].includes(rawCategory) ? 'female' : 'male'

      const filename = parts[parts.length - 1]
      const folderParts = catIndex >= 0 ? parts.slice(catIndex + 1, parts.length - 1) : []
      const folder = folderParts.join('/')
      const name = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const id = `${category}/${folder}/${filename}`
      return { id, name, url, category: category as 'female' | 'male', folder }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

const cache = new Map<string, AssetItem[]>()

export function getAssets(categoryInput: string, folder?: string): AssetItem[] {
  // normalize category input to canonical keys used in cache: 'female' | 'male'
  const normalizeCategory = (s: string) => {
    const lp = String(s || '').toLowerCase()
    if (['girl', 'girls', 'female', 'woman', 'women'].includes(lp)) return 'female'
    if (['men', 'man', 'male', 'guys'].includes(lp)) return 'male'
    return lp
  }

  const category = normalizeCategory(categoryInput)

  if (!cache.has(category)) {
    const mods = loadModulesForCategory(category)
    const items = buildItemsFromModules(mods)
    cache.set(category, items)
  }

  const items = cache.get(category) ?? []
  if (!folder) return items

  // normalize folder comparison so folder names like "ethnicity" or "hair-style"
  // match when the caller passes canonical names. This handles spaces, case and underscores.
  const slug = (s: string) =>
    s
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[_]+/g, '-')
      .replace(/[^a-z0-9\/ -]+/g, '')
      .replace(/-{2,}/g, '-')

  const want = slug(folder)
  return items.filter(i => slug(i.folder) === want)
}

export function getAllAssets(): Record<string, AssetItem[]> {
  return {
    female: getAssets('female'),
    male: getAssets('male'),
  }
}

export default { getAssets, getAllAssets }
