// @ts-expect-error s2-geometry lacks TypeScript declarations
import { S2 } from 's2-geometry'

// S2 cell level 8 = ~32km cells (~20mi) for 20mi radius coverage
const S2_LEVEL = 8

/**
 * Convert coordinates to S2 cell ID
 */
export function coordsToCellId(lat: number, lng: number): string {
	const key = S2.latLngToKey(lat, lng, S2_LEVEL)
	return S2.keyToId(key)
}

/**
 * Get the cell ID and all neighboring cells for proximity queries
 * Returns center cell + neighbors for ~60mi diameter (~30mi radius) coverage
 */
export function getCellIdWithNeighbors(lat: number, lng: number): string[] {
	const key = S2.latLngToKey(lat, lng, S2_LEVEL)
	const cellId = S2.keyToId(key)
	const neighbors = S2.latLngToNeighborKeys(lat, lng, S2_LEVEL).map(
		(k: string) => S2.keyToId(k),
	)
	return [cellId, ...neighbors]
}
