# Into the Portfolio-Verse

An interactive 3D portfolio inspired by *The Amazing Spider-Man* and *Spider-Man: Across the Spider-Verse*, built with Three.js and Vite. Everything (Spider-Man, the portal, the city, cars, rain and all the sound) is generated in code, so there are no 3D model or audio files.

**Sound:** soft rain and a warm portal pad, all synthesised. Clicking "Enter the Verse" fades it in gently; the slider in the top-right sets the volume anywhere on the site.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Edit your content

All text on the hero, the three billboards and the glass panels comes from **`src/content.js`**:
`profile`, `about`, `projects`, `goals` and `contact`. Save the file and the site reloads.

## The scroll journey

| Scroll | What happens |
| --- | --- |
| 0 – 15% | The yellow-orange collider portal; Spider-Man swings in on a web and through the membrane |
| 13 – 27% | Camera dives into the portal tunnel → dimension-jump glitch + flash |
| 27 – 42% | Skydive from the clouds over the rainy neon city, front-flip, superhero landing |
| 47 – 50% | Over-the-shoulder reveal of the skyline and the three billboard towers |
| 54 – 87% | Camera flies to each billboard: **About**, **Projects**, **Future Goals**. From the skyline onward, one scroll gesture moves to the next stop |
| 93 – 100% | Wide outro + contact panel |

Timings live in `src/core/timeline.js`.

## Where things are

```
src/
  main.js              renderer, scroll → camera choreography, scene swap, triggers
  content.js           ← your portfolio text
  core/post.js         bloom + Spider-Verse lens (halftone, chromatic misprint, glitch)
  core/timeline.js     scroll timings and nav stops
  scenes/portal.js     collider portal, vortex shader, tunnel, particles, shards
  scenes/city.js       city layout, wet reflective street, neon signs, towers, lightning
  world/spiderman.js   procedural cel-shaded Spider-Man + poses
  world/billboards.js  animated canvas billboards (the "moving pictures")
  world/cars.js        instanced traffic
  world/rain.js        GPU rain
  ui/ui.js             HUD, nav, glass panels, comic SFX, cursor web-splats
  ui/audio.js          synthesised rain, portal pad, thunder and thwip / whoosh / impact effects
```

Performance: the renderer lowers its resolution automatically if the frame rate drops, and phones get fewer buildings, rain drops and cars, with no planar reflection.
