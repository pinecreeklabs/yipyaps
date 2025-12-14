import { useState } from 'react'
import { resolveCityFromCoords } from '../lib/geolocation'
import { Button } from './ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from './ui/dialog'

type ModalState = 'initial' | 'locating' | 'found' | 'error'

interface CityOnboardingModalProps {
	open: boolean
}

export function CityOnboardingModal({ open }: CityOnboardingModalProps) {
	const [state, setState] = useState<ModalState>('initial')
	const [cityName, setCityName] = useState<string | null>(null)
	const [citySlug, setCitySlug] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const handleFindCity = async () => {
		if (!navigator.geolocation) {
			setError('Geolocation is not supported by your browser')
			setState('error')
			return
		}

		setState('locating')
		setError(null)

		try {
			const position = await new Promise<GeolocationPosition>(
				(resolve, reject) => {
					navigator.geolocation.getCurrentPosition(resolve, reject, {
						enableHighAccuracy: true,
						timeout: 10000,
						maximumAge: 0,
					})
				},
			)

			const { latitude, longitude } = position.coords
			const result = await resolveCityFromCoords({
				data: { latitude, longitude },
			})

			setCityName(result.cityName)
			setCitySlug(result.citySlug)
			setState('found')
		} catch (err) {
			console.error('[CityOnboarding] Error:', err)
			if (
				err &&
				typeof err === 'object' &&
				'code' in err &&
				typeof err.code === 'number'
			) {
				const geolocationError = err as GeolocationPositionError
				if (geolocationError.code === 1) {
					setError('Location permission denied. Please enable location access.')
				} else if (geolocationError.code === 2) {
					setError('Location unavailable. Please try again.')
				} else {
					setError('Location request timed out. Please try again.')
				}
			} else {
				setError('Failed to determine your city. Please try again.')
			}
			setState('error')
		}
	}

	const handleGoToCity = () => {
		if (!citySlug) return

		const isLocalhost =
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1'
		const cookieDomain = isLocalhost ? '' : '; Domain=.yipyaps.com'
		const secureFlag = isLocalhost ? '' : '; Secure'
		document.cookie = `yipyaps_city_slug=${citySlug}; Path=/; Max-Age=86400${secureFlag}; SameSite=Lax${cookieDomain}`

		if (isLocalhost) {
			window.location.reload()
		} else {
			window.location.href = `https://${citySlug}.yipyaps.com`
		}
	}

	return (
		<Dialog open={open}>
			<DialogContent showCloseButton={false} className="text-center">
				<DialogHeader className="items-center">
					<DialogTitle className="font-[family-name:var(--font-display)] text-3xl">
						{state === 'found'
							? `You're in ${cityName}!`
							: 'Welcome to Yipyaps'}
					</DialogTitle>
					<DialogDescription className="text-base">
						{state === 'initial' &&
							"Share quick notes with your city. Let's find where you are."}
						{state === 'locating' && 'Finding your location...'}
						{state === 'found' &&
							'Ready to see what your neighbors are sharing?'}
						{state === 'error' && error}
					</DialogDescription>
				</DialogHeader>

				<div className="mt-4 flex justify-center">
					{state === 'initial' && (
						<Button
							onClick={handleFindCity}
							size="lg"
							className="bg-primary font-medium text-primary-foreground shadow-md hover:bg-primary/90"
						>
							Find my city
						</Button>
					)}

					{state === 'locating' && (
						<div className="flex items-center gap-3 text-muted-foreground">
							<svg
								className="h-5 w-5 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							<span>Locating...</span>
						</div>
					)}

					{state === 'found' && cityName && (
						<Button
							onClick={handleGoToCity}
							size="lg"
							className="bg-primary font-medium text-primary-foreground shadow-md hover:bg-primary/90"
						>
							Go to {cityName}
						</Button>
					)}

					{state === 'error' && (
						<Button
							onClick={handleFindCity}
							size="lg"
							variant="outline"
							className="font-medium"
						>
							Try again
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
