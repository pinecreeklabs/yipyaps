import { Post } from "@/db";
import { createPost, getPosts } from "@/lib/posts";
import { UserLocation } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const POSTS_QUERY_KEY = "posts";

export function usePosts(userLocation: UserLocation | null) {
  return useQuery({
    queryKey: [POSTS_QUERY_KEY],
    queryFn: () => {
      if (!userLocation) return [];

      return getPosts({
        data: {
          userLat: userLocation.latitude,
          userLng: userLocation.longitude,
        },
      });
    },
    staleTime: 1000 * 5, // 5 seconds
    enabled: !!userLocation,
  });
}

export function useCreatePost(userLocation: UserLocation | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: Post) => {
      if (!userLocation) {
        return Promise.reject(new Error("User location is required"));
      }
      return createPost({
        data: {
          content: post.content,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSTS_QUERY_KEY] });
    },
  });
}
