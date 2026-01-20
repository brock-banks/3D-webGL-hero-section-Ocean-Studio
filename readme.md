# Ocean Studio — WebGL Dive Site

A cinematic, scroll-driven WebGL landing page built with **Three.js** + **GSAP ScrollTrigger**.

## Features
- **Three.js water scene** using `Water` (real-time animated surface)
- **Scroll-controlled “dive”** (camera movement, fog, color grading)
- **DOM overlays**
  - Hero bubbles (`#bubble-layer`)
  - Section bubbles (`#section-bubbles`)
  - Fish shadows (`#fish-layer`)
  - Whale silhouette (`#whale-layer`)
- **Motion controls**
  - “Reduce motion” toggle
  - Respects `prefers-reduced-motion`
- **Neon cursor** (desktop only) with ripple trails
- **Performance-minded**
  - DPR cap for mobile-ish devices
  - Lower render target size on mobile
  - Optional render pause deeper in the page
- **WebGL fallback** background when WebGL fails

## Project structure (typical)
```text
.
├── ocean_studio2.html
├── styles_ocean.css
├── water_scene.js
└── assets
    ├── logo.png
    ├── cloud.png
    └── waternormals.jpg
```

## Run locally
Because this uses ES modules (`type="module"`) + an import map, run from a local server (not `file://`).

### Option A: VS Code Live Server
1. Install **Live Server**
2. Right click `ocean_studio2.html` → **Open with Live Server**

### Option B: Python
```bash
python -m http.server 5173
```
Then open:
- `http://localhost:5173/ocean_studio2.html`

## Customize
### Change navigation items
Edit the mid nav in `ocean_studio2.html`:
```html
<nav class="midnav">
  <a class="midnav__link" href="#section-1">What we do</a>
  <a class="midnav__link" href="#section-2">Work</a>
  <a class="midnav__link" href="#section-3">Contact</a>
</nav>
```

### Adjust overlay strength
In `styles_ocean.css`:
- Whale visibility is mainly controlled by `.whale` `opacity` + `filter: blur(...)`
- Bubbles are controlled by `opacity` + animation

### Assets
Replace files inside `assets/`:
- `assets/logo.png` — brand mark
- `assets/cloud.png` — sky cloud sprite
- `assets/waternormals.jpg` — water normal map

## Notes / troubleshooting
- If overlays (whale/fish/bubbles) disappear, it’s almost always a **z-index** layering issue.  
  Ensure overlays sit **between** section backgrounds and the `.content` text.
- The neon cursor is disabled automatically on:
  - touch devices (`pointer: coarse`)
  - OS reduced motion (`prefers-reduced-motion: reduce`)

## Tech
- [Three.js](https://threejs.org/)
- [GSAP](https://gsap.com/)
- [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)