# Game Gallery: next steps for continuation

## Current state

The site is a Next.js static export deployed to GitHub Pages from `main` via `.github/workflows/deploy.yml`.

Recent visual work added:
- cinematic hero using real gallery screenshots;
- large visual album covers;
- upgraded lightbox with keyboard navigation, counter, blurred background, and close controls;
- lighter hero/cover treatment after the first pass was too dark;
- soft edge vignette on hero and album covers to reduce distracting screenshot detail near the edges.

Local preview:
- dev server: `npm run dev`
- static build: `npm run build`
- static preview: `python3 -m http.server 3001 --directory out`

GitHub Pages build uses:
- `NEXT_PUBLIC_BASE_PATH=/<repo-name> npx --no-install next build`
- output folder: `out`

## Known notes

- Full-project `npm run lint` still reports older unrelated lint debt in files such as `Scene3D.tsx`, `SmoothScroll.tsx`, `useSound.ts`, and `scripts/sync-gallery.js`.
- The files touched in the recent visual work were checked separately with ESLint and passed.
- `next/font` may need network access during build to fetch Google fonts.
- The in-app browser screenshot tool sometimes times out on full-page screenshots; smaller CUA screenshots worked intermittently.

## Suggested next improvements

1. Add per-game atmosphere tokens.
   - Cyberpunk: cyan/magenta neon glow.
   - Witcher: warm sunset and forest haze.
   - S.T.A.L.K.E.R.: cold green-gray anomaly mood.
   - Kingdom Come: soft daylight realism.

2. Add a proper album detail mode.
   - When an album opens, keep the cover as a sticky visual header.
   - Add frame count, selected game title, and subtle progress markers.
   - Make the grid feel like a curated exhibition, not just thumbnails.

3. Improve lightbox polish.
   - Add thumbnail strip or minimal frame rail.
   - Add previous/next preview hints.
   - Add swipe support on mobile.
   - Tune image sizing per viewport.

4. Improve performance and stability.
   - Replace heavy global cursor hiding rules with scoped cursor handling.
   - Review image loading priority and sizes.
   - Reduce unnecessary duplicated visual layers.
   - Fix full-project lint issues.

5. Refine mobile layout.
   - Make hero text and metadata less crowded on narrow screens.
   - Ensure album titles never wrap awkwardly.
   - Keep at least a hint of the next section visible below the hero.

6. Add editorial content.
   - Add game-specific intro copy.
   - Add date/location/style metadata for screenshots.
   - Add a short curator note per album.

7. Deployment follow-up.
   - After push, check the GitHub Pages Actions run.
   - Verify the live URL: `https://olegk1986.github.io/Game-Gallery/`
   - If assets 404, inspect `NEXT_PUBLIC_BASE_PATH` and generated image paths.

## Suggested prompt for a new chat

Continue work on `/Users/olegkrugliak/Codex/Сайт`. Read `NEXT_STEPS.md`, inspect the current UI, and continue improving the Game Gallery site from the latest committed state. Start with per-game atmosphere tokens and mobile layout polish, then verify with build and local preview.
