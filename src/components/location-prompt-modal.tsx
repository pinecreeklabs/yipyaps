import { useState } from 'react'
import { Button } from './ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from './ui/dialog'

type ModalState = 'initial' | 'locating' | 'error'

interface LocationPromptModalProps {
	open: boolean
	onLocationGranted: (lat: number, lng: number) => void
	error?: string | null
}

export function LocationPromptModal({
	open,
	onLocationGranted,
	error: externalError,
}: LocationPromptModalProps) {
	const [state, setState] = useState<ModalState>('initial')
	const [error, setError] = useState<string | null>(null)

	const handleEnableLocation = async () => {
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

			onLocationGranted(position.coords.latitude, position.coords.longitude)
		} catch (err) {
			console.error('[LocationPrompt] Error:', err)
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
				setError('Failed to get location. Please try again.')
			}
			setState('error')
		}
	}

	const displayError = error || externalError

	return (
		<Dialog open={open}>
			<DialogContent showCloseButton={false} className="text-center">
				<DialogHeader className="items-center">
					<DialogTitle className="font-display text-3xl">
						Welcome to Yipyaps
					</DialogTitle>
					<DialogDescription className="text-base">
						{state === 'initial' &&
							'Share quick notes with people nearby. Enable location to get started.'}
						{state === 'locating' && 'Getting your location...'}
						{state === 'error' && displayError}
					</DialogDescription>
				</DialogHeader>

				<div className="mt-4 flex justify-center">
					{state === 'initial' && (
						<Button
							onClick={handleEnableLocation}
							size="lg"
							className="bg-primary font-medium text-primary-foreground shadow-md hover:bg-primary/90"
						>
							Enable Location
						</Button>
					)}

					{state === 'locating' && (
						<div className="flex items-center gap-3 text-muted-foreground">
							<svg
								className="h-5 w-5 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
								role="img"
								aria-labelledby="loading-title"
							>
								<title id="loading-title">Loading</title>
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

					{state === 'error' && (
						<Button
							onClick={handleEnableLocation}
							size="lg"
							variant="outline"
							className="font-medium"
						>
							Try again
						</Button>
					)}
				</div>

				<p className="mt-4 text-xs text-muted-foreground">
					Your exact location is never shared. Posts only show approximate area.
				</p>
			</DialogContent>
		</Dialog>
	)
}
