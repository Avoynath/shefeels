import { useMemo } from 'react'
import { getAssets } from '../utils/assets'
import type { AssetItem } from '../utils/assets'

// Accept string category inputs (legacy or canonical). getAssets will normalize.
export function useAssets(category: string, folder?: string): { items: AssetItem[] } {
  const items = useMemo(() => getAssets(category, folder), [category, folder])
  return { items }
}

export default useAssets
