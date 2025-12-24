export interface UserLocation {
    latitude: number
    longitude: number
}

export interface GetPostsInput {
    userLat: number
    userLng: number
}

export interface CreatePostInput {
    content: string
    latitude: number
    longitude: number
}

export interface CreatePostResult {
    success: boolean
    blocked?: boolean
    message?: string
}
