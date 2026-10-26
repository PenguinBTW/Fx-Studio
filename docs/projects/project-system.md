# Multi-Project Workspace & Manifest Architecture

**f(x) Studio v0.7.0** features a modular, multi-project architecture designed to support diverse procedural motion productions within a single unified engine repository.

---

## 1. Directory Structure

Projects reside in isolated subdirectories inside `app/src/scenes/<project_name>/`:

```
app/
├── src/
│   ├── engine/                       # Core rendering & compositor modules
│   ├── transitions/                  # Standalone GPU transition classes
│   ├── timeline.ts                   # Universal timeline assembler
│   └── scenes/
│       ├── active.json               # Pointer to current default active project
│       │
│       ├── brand_campaign/           # Example: Brand campaign production
│       │   ├── project.json          # Project manifest & transition definitions
│       │   ├── act1_intro.ts
│       │   ├── act2_macro_product.ts
│       │   └── act3_resolve.ts
│       │
│       ├── product_reveal/           # Example: 3D hardware reveal
│       │   ├── project.json
│       │   └── ...
│       │
│       └── spatial_ui/               # Example: UI interaction showcase
│           ├── project.json
│           └── ...
```

---

## 2. Project Selection Priority

When the engine initializes in `app/src/timeline.ts`, the active project is resolved using a strict priority cascade:

1. **URL Parameter (`?project=<id>`)**:
   Explicit URL override (e.g. `http://localhost:5173/?project=brand_campaign`). Highest priority.
2. **Active Pointer File (`app/src/scenes/active.json`)**:
   Local project selector read at runtime:
   ```json
   {
     "project": "brand_campaign"
   }
   ```
3. **Engine Default**: Falls back to `'default'` if `active.json` is missing.

---

## 3. Project Manifest Specification (`project.json`)

Each project folder defines its scenes and transitions in a `project.json` manifest:

```json
{
  "project": "brand_campaign",
  "title": "Brand Kinetic Identity 2026",
  "bpm": 120.0,
  "audio": "public/audio/soundtrack.mp3",
  "entries": [
    {
      "scene": "brand_campaign/act1_intro",
      "id": "act1_intro",
      "start": 0.0,
      "end": 8.5,
      "caption": "ACT I // IDENTITY HERO"
    },
    {
      "scene": "brand_campaign/act2_macro_product",
      "id": "act2_macro_product",
      "start": 7.5,
      "end": 18.0,
      "caption": "ACT II // MACRO DETAILS"
    }
  ],
  "transitions": [
    {
      "id": "t1-aperture-morph",
      "transition": "dissolve",
      "from": "act1_intro",
      "to": "act2_macro_product",
      "at": 8.0,
      "dur": 1.0
    }
  ]
}
```

### Manifest Fields:
- `entries`: Ordered sequence of scenes. `start` and `end` define timeline intervals in seconds. Notice that consecutive scenes have overlapping windows ($0.5\text{–}2.0\,\text{s}$) where transitions occur.
- `transitions`: Declares standalone GPU transitions between scenes.
  - `transition`: Matches any of the 16 transition classes in `app/src/transitions/` (e.g. `dissolve`, `portal_dive`, `shutter_wipe`, `chromatic_aberration_whip`, etc.).
  - `at`: Exact center timestamp of the transition cut.
  - `dur`: Total duration of the standalone transition window in seconds.

---

## 4. Hot Module Replacement (HMR) & Scene Independence

Scene files are imported via Vite's `import.meta.glob`:
```typescript
const sceneModules = import.meta.glob<{ default: SceneClass }>('./scenes/**/*.ts');
```
- **Isolated Compilation**: A TypeScript error in `scenes/experimental/` never prevents `scenes/brand_campaign/` from loading or rendering.
- **Granular HMR**: Editing a scene updates that single scene in the live browser without reloading the engine or resetting audio playback.

---

## 5. Interactive Preview Player & Developer Controls (`bun dev`)

To launch the real-time interactive development environment:
```bash
# From workspace root:
cd app && bun run dev

# Or using the root bun script if configured:
bun dev
```
Open `http://localhost:5173` in any modern Chromium/WebGPU/WebGL2 browser.

### Keyboard & Scrubbing Controls
The preview player (`app/src/main.ts`) includes built-in timeline navigation hotkeys:

| Keybinding | Action | Description |
| :--- | :--- | :--- |
| `Space` | **Play / Pause** | Toggle playback at normal 60 fps speed. |
| `ArrowRight` / `ArrowLeft` | **Step 1 Second** | Jump $+1.0\,\text{s}$ or $-1.0\,\text{s}$ forward/backward. |
| `Shift + ArrowRight` / `Left` | **Step 5 Seconds** | Jump $+5.0\,\text{s}$ or $-5.0\,\text{s}$ forward/backward. |
| `.` (period) / `,` (comma) | **Step 1 Frame** | Step exactly 1 frame forward or backward ($1/60\,\text{s} \approx 0.0167\,\text{s}$). |
| `]` / `[` | **Jump Scene Cut** | Jump to the next or previous scene cut boundary. |
| `l` (L) | **Toggle Scene Loop** | Loops the current active scene duration `[start, end]`. |
| `h` | **Toggle UI Overlay** | Hide/show scrubber bar, timecode, and scene marker chips. |
| **Timeline Marker Click** | **Direct Scene Jump** | Click any scene chip on the timeline scrubber to seek immediately to its start frame. |

### Browser URL Query Parameters
You can customize the preview session directly through URL query strings:
* `http://localhost:5173/?project=brand_campaign`: Preview a specific project folder.
* `http://localhost:5173/?only=act1_intro`: Isolate a single scene (skips all other assets for ultra-fast boot).
* `http://localhost:5173/?t=33.55`: Start playback directly at $33.55\,\text{s}$.
* `http://localhost:5173/?scale=2`: Preview at true $2\times$ Retina/4K resolution ($3840 \times 2160$).
* `http://localhost:5173/?audio=audio/custom.mp3`: Override the background audio track.

---

## 6. How to Create and Wire a New Project (Step-by-Step)

Follow this recipe to stand up a brand-new procedural production:

### Step 1: Create Project Folder
```bash
mkdir -p app/src/scenes/my_new_campaign
```

### Step 2: Define `project.json`
Create `app/src/scenes/my_new_campaign/project.json`:
```json
{
  "project": "my_new_campaign",
  "title": "Brand Kinetic Identity 2026",
  "bpm": 120.0,
  "entries": [
    {
      "scene": "my_new_campaign/scene1_intro",
      "id": "scene1_intro",
      "start": 0.0,
      "end": 6.5
    },
    {
      "scene": "my_new_campaign/scene2_reveal",
      "id": "scene2_reveal",
      "start": 5.5,
      "end": 14.0
    }
  ],
  "transitions": [
    {
      "id": "t1-bespoke-wipe",
      "transition": "dissolve",
      "from": "scene1_intro",
      "to": "scene2_reveal",
      "at": 6.0,
      "dur": 1.0
    }
  ]
}
```

### Step 3: Implement the Scene Files
Create `app/src/scenes/my_new_campaign/scene1_intro.ts` using `defineScene` or raw `Scene`:
```typescript
import { defineScene, type SceneContext } from '../../engine/dsl';

export default defineScene({
  name: 'scene1_intro',
  init(ctx: SceneContext) {
    ctx.setCamera({ fov: 45, near: 0.1, far: 100 });
  },
  render(ctx: SceneContext, f) {
    ctx.renderText('HELLO WORLD', {
      x: 960,
      y: 540,
      align: 'center',
      fontSize: 64,
      color: ctx.tokens.signal,
    });
    return { bloom: 0.2 };
  },
});
```

### Step 4: Preview and Render
Preview interactively:
```bash
# Open in browser:
http://localhost:5173/?project=my_new_campaign
```
Or render headless stills or video directly via CLI:
```bash
# Capture still frame:
bun scripts/render.ts stills --project my_new_campaign --t 2.5 --out out/my_campaign/

# Export video:
bun scripts/render.ts video --project my_new_campaign --from 0 --to 14 --out out/my_campaign.mp4
```
