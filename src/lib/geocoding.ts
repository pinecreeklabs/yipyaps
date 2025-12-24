interface GeocodeResult {
    city: string | null
    citySlug: string | null
}

interface GoogleGeocodeResponse {
    status: string
    results?: Array<{
        address_components?: Array<{
            long_name: string
            types: string[]
        }>
    }>
}

/**
 * Resolve city name from coordinates using Google Geocoding API
 * Returns null if geocoding fails (non-blocking)
 */
export async function resolveCity(lat: number, lng: number, apiKey: string): Promise<GeocodeResult> {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`,
        )

        if (!response.ok) {
            console.error('[geocoding] API error:', response.status)
            return { city: null, citySlug: null }
        }

        const data: GoogleGeocodeResponse = await response.json()

        if (data.status !== 'OK' || !data.results?.length) {
            console.error('[geocoding] No results:', data.status)
            return { city: null, citySlug: null }
        }

        // Find city from address components
        for (const result of data.results) {
            for (const component of result.address_components || []) {
                const types = component.types || []
                if (
                    types.includes('locality') ||
                    types.includes('sublocality') ||
                    types.includes('administrative_area_level_2')
                ) {
                    const city = component.long_name
                    const citySlug = city
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    return { city, citySlug }
                }
            }
        }

        return { city: null, citySlug: null }
    } catch (error) {
        console.error('[geocoding] Error:', error)
        return { city: null, citySlug: null }
    }
}
