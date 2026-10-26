import { Redirect } from 'expo-router';

/**
 * Explore is gone (IA phase P5): its content moved to You (shape, traits,
 * categories + the deep dive, full profile). The route file stays so an old push
 * or deep link to `/explore` still lands somewhere: on You, at the categories.
 */
export default function ExploreScreen() {
  return <Redirect href="/you?section=categories" />;
}
