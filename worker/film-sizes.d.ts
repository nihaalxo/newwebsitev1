// .build/film-sizes.json is written by `npm run build` (scripts/postbuild.mjs): each film in out/ by its address,
// e.g. { "/films/lair-ship.mp4": 2818651 }. Wrangler bundles the file; this tells TypeScript its shape.
declare module '*/film-sizes.json' {
  const sizes: Record<string, number>;
  export default sizes;
}
