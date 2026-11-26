/**
 * Shared, late-bound game context. Modules import `game` and access members at
 * runtime (after main.js has wired everything), which avoids circular imports.
 */
export const game = {
  engine: null,
  ui: null,
  world: null,
  lab: null,
  constellation: null,
  quests: null,
  mode: 'loading', // loading | title | world | lab | constellation
};
