/**
 * generate-placeholder-assets.cjs
 *
 * Generates all placeholder assets for Watch Claw v1.0 Phaser migration.
 * These are temporary — replace with real art when ready (same filenames).
 *
 * Usage: node scripts/generate-placeholder-assets.cjs
 *
 * Note: interior.png and lobster.png are downloaded from OpenGameArt
 * (see public/assets/CREDITS.md). This script will NOT overwrite them
 * if they already exist. To force regeneration, delete them first.
 *
 * Requires: ImageMagick 7+ (`magick` command) and ffmpeg
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const ASSETS = path.join(ROOT, 'public/assets')

function run(cmd) {
  console.log(`  $ ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

// ─── 1. Particle Effects ──────────────────────────────────────────────────────

function generateConfetti() {
  const out = path.join(ASSETS, 'effects/confetti.png')
  console.log('\n[1/8] Generating confetti.png (20×4) ...')
  ensureDir(path.dirname(out))
  run(
    `magick -size 20x4 xc:none ` +
      `-fill '#FF4444' -draw 'rectangle 0,0 3,3' ` +
      `-fill '#FFD700' -draw 'rectangle 4,0 7,3' ` +
      `-fill '#22C55E' -draw 'rectangle 8,0 11,3' ` +
      `-fill '#4488FF' -draw 'rectangle 12,0 15,3' ` +
      `-fill '#FF69B4' -draw 'rectangle 16,0 19,3' ` +
      `"${out}"`
  )
}

function generateZzz() {
  const out = path.join(ASSETS, 'effects/zzz.png')
  console.log('\n[2/8] Generating zzz.png (8×8) ...')
  run(
    `magick -size 8x8 xc:none -fill white ` +
      `-draw 'rectangle 1,1 5,1' ` +
      `-draw 'point 4,2' ` +
      `-draw 'point 3,3' ` +
      `-draw 'point 2,4' ` +
      `-draw 'rectangle 1,5 5,5' ` +
      `"${out}"`
  )
}

function generateSpark() {
  const out = path.join(ASSETS, 'effects/spark.png')
  console.log('\n[3/8] Generating spark.png (4×4) ...')
  run(
    `magick -size 4x4 xc:none ` +
      `-fill '#FF880066' -draw 'rectangle 0,0 3,3' ` +
      `-fill '#FF8800' -draw 'rectangle 1,0 2,3' ` +
      `-fill '#FF8800' -draw 'rectangle 0,1 3,2' ` +
      `-fill '#FFDD00' -draw 'rectangle 1,1 2,2' ` +
      `"${out}"`
  )
}

// ─── 2. Emotion Bubbles ───────────────────────────────────────────────────────

function generateEmotions() {
  const out = path.join(ASSETS, 'ui/emotions.png')
  console.log('\n[4/8] Generating emotions.png (128×16) ...')
  ensureDir(path.dirname(out))

  // Create 8 emotion frames (16×16 each) = 128×16 total
  // Each frame: white bubble background + colored icon
  // rects: [x1, y1, x2, y2] relative to frame origin
  const emotions = [
    { color: '#FFD700', rects: [[6,4,9,7],[7,3,8,4],[7,8,8,11]] },               // focused: lightbulb
    { color: '#A855F7', rects: [[6,3,9,4],[8,4,9,6],[6,6,9,7],[6,7,7,9],[7,10,8,11]] }, // thinking: ?
    { color: '#6B7280', rects: [[4,5,8,9],[5,4,7,5],[5,9,7,10],[10,3,12,5],[11,5,12,6]] }, // sleepy: moon+z
    { color: '#22C55E', rects: [[7,3,8,12],[3,7,12,8],[5,5,6,6],[9,5,10,6],[5,9,6,10],[9,9,10,10]] }, // happy: star
    { color: '#EF4444', rects: [[7,3,8,9],[7,11,8,12]] },                         // confused: !
    { color: '#F59E0B', rects: [[5,4,10,9],[6,3,9,4],[6,9,9,10],[10,9,12,10]] },  // curious: magnifier
    { color: '#DC2626', rects: [[7,3,8,4],[6,4,7,6],[7,6,8,7],[8,7,9,9],[7,9,8,10],[7,11,8,12]] }, // serious: lightning
    { color: '#10B981', rects: [[4,7,5,8],[5,8,6,9],[6,9,7,10],[7,8,8,9],[8,7,9,8],[9,6,10,7],[10,5,11,6]] }, // satisfied: check
  ]

  let cmd = `magick -size 128x16 xc:none`

  emotions.forEach((emo, i) => {
    const ox = i * 16
    // White bubble background (rounded-ish)
    cmd += ` -fill '#FFFFFFDD' -draw 'rectangle ${ox + 1},1 ${ox + 14},14'`
    cmd += ` -fill '#FFFFFFDD' -draw 'rectangle ${ox + 2},0 ${ox + 13},15'`
    cmd += ` -fill '#FFFFFFDD' -draw 'rectangle ${ox},2 ${ox + 15},13'`
    // Colored icon rectangles
    for (const [x1, y1, x2, y2] of emo.rects) {
      cmd += ` -fill '${emo.color}' -draw 'rectangle ${ox + x1},${y1} ${ox + x2},${y2}'`
    }
  })

  cmd += ` "${out}"`
  run(cmd)
}

// ─── 3. Furniture Tileset ─────────────────────────────────────────────────────

function generateFurniture() {
  const out = path.join(ASSETS, 'tilesets/furniture.png')
  console.log('\n[5/8] Generating furniture.png (320×16, 20 tiles) ...')
  ensureDir(path.dirname(out))

  // 20 furniture tiles, each 16×16, in a horizontal strip
  const tiles = [
    { name: 'desk', bg: '#8B7355', detail: '#6B5335', detailRect: '2,12 13,13' },
    { name: 'monitor', bg: '#333333', detail: '#44AAFF', detailRect: '3,2 12,9' },
    { name: 'chair', bg: '#4a7ab5', detail: '#3a6a95', detailRect: '4,3 11,10' },
    { name: 'bed-l', bg: '#6688AA', detail: '#FFFFFF', detailRect: '1,3 6,7' },
    { name: 'bed-r', bg: '#6688AA', detail: '#8899BB', detailRect: '3,3 14,12' },
    { name: 'nightstand', bg: '#8B7355', detail: '#FFD700', detailRect: '5,2 10,5' },
    { name: 'bookshelf-full', bg: '#6B5335', detail: '#CC4444', detailRect: '2,2 5,6' },
    { name: 'bookshelf-half', bg: '#6B5335', detail: '#4488CC', detailRect: '2,2 5,6' },
    { name: 'couch-l', bg: '#AA6644', detail: '#CC8866', detailRect: '1,4 7,12' },
    { name: 'couch-r', bg: '#AA6644', detail: '#CC8866', detailRect: '8,4 14,12' },
    { name: 'server', bg: '#555555', detail: '#44FF44', detailRect: '6,2 7,3' },
    { name: 'workbench', bg: '#8B7355', detail: '#888888', detailRect: '2,2 13,5' },
    { name: 'toolwall', bg: '#555555', detail: '#AAAAAA', detailRect: '3,2 12,12' },
    { name: 'crate', bg: '#AA8855', detail: '#886633', detailRect: '1,1 14,14' },
    { name: 'shelf', bg: '#8B7355', detail: '#AA8855', detailRect: '1,3 14,5' },
    { name: 'trashbin', bg: '#666666', detail: '#888888', detailRect: '3,1 12,14' },
    { name: 'railing', bg: '#AAAAAA', detail: '#888888', detailRect: '7,0 8,15' },
    { name: 'plant', bg: '#22AA44', detail: '#885533', detailRect: '6,8 9,14' },
    { name: 'oldpc', bg: '#777766', detail: '#44AA44', detailRect: '3,2 12,8' },
    { name: 'cables', bg: '#333333', detail: '#CC4444', detailRect: '2,6 13,8' },
  ]

  let cmd = `magick -size 320x16 xc:none`
  tiles.forEach((tile, i) => {
    const ox = i * 16
    // Background fill
    cmd += ` -fill '${tile.bg}' -draw 'rectangle ${ox + 1},1 ${ox + 14},14'`
    // Detail
    const [x1, y1, x2, y2] = tile.detailRect.split(/[, ]/).map(Number)
    cmd += ` -fill '${tile.detail}' -draw 'rectangle ${ox + x1},${y1} ${ox + x2},${y2}'`
  })
  cmd += ` "${out}"`
  run(cmd)
}

// ─── 4. Tilemap JSON ──────────────────────────────────────────────────────────

function generateTilemap() {
  const out = path.join(ASSETS, 'tilemaps/house.json')
  console.log('\n[6/8] Generating house.json (30×30 Tiled format) ...')
  ensureDir(path.dirname(out))

  const W = 30, H = 30
  const empty = () => new Array(W * H).fill(0)

  // Build floor layer — 2F at rows 10-19 (middle of 30-row map)
  const floors = empty()
  for (let row = 19; row < 20; row++) {
    for (let col = 0; col < W; col++) {
      floors[row * W + col] = 2 // floor tile (index 1 + 1 for Tiled 1-based)
    }
  }

  // Build walls layer — walls at edges of rooms
  const walls = empty()
  // Left wall
  for (let row = 10; row < 20; row++) walls[row * W + 0] = 3
  // Right wall
  for (let row = 10; row < 20; row++) walls[row * W + 29] = 3
  // Dividers at col 10 and col 20
  for (let row = 10; row < 19; row++) {
    walls[row * W + 10] = 3
    walls[row * W + 20] = 3
  }
  // Ceiling
  for (let col = 0; col < W; col++) walls[10 * W + col] = 3

  // Build collision layer — floor + walls
  const collision = empty()
  for (let col = 0; col < W; col++) collision[19 * W + col] = 2
  for (let row = 10; row < 20; row++) {
    collision[row * W + 0] = 2
    collision[row * W + 29] = 2
    collision[row * W + 10] = 2
    collision[row * W + 20] = 2
  }
  for (let col = 0; col < W; col++) collision[10 * W + col] = 2

  // Background — fill exterior with wall tile
  const background = empty()
  for (let row = 0; row < H; row++) {
    for (let col = 0; col < W; col++) {
      if (row < 10 || row >= 20) background[row * W + col] = 3
    }
  }

  const tilemap = {
    compressionlevel: -1,
    height: H,
    infinite: false,
    layers: [
      { data: background, height: H, id: 1, name: 'background', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
      { data: floors, height: H, id: 2, name: 'floors', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
      { data: walls, height: H, id: 3, name: 'walls', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
      { data: collision, height: H, id: 4, name: 'collision', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
      { data: empty(), height: H, id: 5, name: 'foreground', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0 },
      // Object layers
      {
        draworder: 'topdown', id: 6, name: 'spawn_points', objects: [
          { height: 0, id: 1, name: 'player_start', point: true, type: '', visible: true, width: 0, x: 240, y: 288, properties: [] },
        ], opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0,
      },
      {
        draworder: 'topdown', id: 7, name: 'room_zones', objects: [
          { height: 160, id: 2, name: 'workshop', type: '', visible: true, width: 160, x: 0, y: 160, properties: [{ name: 'floor', type: 'int', value: 2 }] },
          { height: 160, id: 3, name: 'study', type: '', visible: true, width: 160, x: 160, y: 160, properties: [{ name: 'floor', type: 'int', value: 2 }] },
          { height: 160, id: 4, name: 'bedroom', type: '', visible: true, width: 160, x: 320, y: 160, properties: [{ name: 'floor', type: 'int', value: 2 }] },
        ], opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0,
      },
      {
        draworder: 'topdown', id: 8, name: 'activity_spots', objects: [
          { height: 0, id: 5, name: 'workshop', point: true, type: '', visible: true, width: 0, x: 80, y: 288, properties: [{ name: 'anim', type: 'string', value: 'type' }, { name: 'direction', type: 'string', value: 'right' }] },
          { height: 0, id: 6, name: 'study', point: true, type: '', visible: true, width: 0, x: 240, y: 288, properties: [{ name: 'anim', type: 'string', value: 'think' }, { name: 'direction', type: 'string', value: 'right' }] },
          { height: 0, id: 7, name: 'bedroom', point: true, type: '', visible: true, width: 0, x: 400, y: 288, properties: [{ name: 'anim', type: 'string', value: 'sleep' }, { name: 'direction', type: 'string', value: 'left' }] },
        ], opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0,
      },
      {
        draworder: 'topdown', id: 9, name: 'ladders', objects: [], opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0,
      },
    ],
    nextlayerid: 10,
    nextobjectid: 8,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: 16,
    tilesets: [
      {
        columns: 12,
        firstgid: 1,
        image: '../tilesets/interior.png',
        imageheight: 128,
        imagewidth: 192,
        margin: 0,
        name: 'interior',
        spacing: 0,
        tilecount: 96,
        tileheight: 16,
        tilewidth: 16,
      },
    ],
    tilewidth: 16,
    type: 'map',
    version: '1.10',
    width: W,
  }

  fs.writeFileSync(out, JSON.stringify(tilemap, null, 2))
  console.log(`  → ${out}`)
}

// ─── 5. Character Spritesheet (programmatic fallback) ─────────────────────────

function generateCharacterSpritesheet() {
  const out = path.join(ASSETS, 'character/lobster.png')
  if (fs.existsSync(out)) {
    console.log('\n[7/8] lobster.png already exists, skipping (delete to regenerate)')
    return
  }
  console.log('\n[7/8] Generating lobster.png (192×256, 6×8 frames of 32×32) ...')
  ensureDir(path.dirname(out))

  // Generate a 192×256 spritesheet with simple colored rectangles per frame
  // Each row = one animation, each col = one frame
  // We draw a simple character in slightly different poses per row
  const frameW = 32, frameH = 32
  const cols = 6, rows = 8
  const totalW = frameW * cols // 192
  const totalH = frameH * rows // 256

  // Base character drawing commands (body, head, hat, eyes, feet)
  // We shift feet positions slightly per frame to simulate animation
  let cmd = `magick -size ${totalW}x${totalH} xc:none`

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = col * frameW
      const oy = row * frameH
      const shift = col % 2 === 0 ? 0 : 1 // alternating slight offset

      // Body (blue)
      cmd += ` -fill '#4a7ab5' -draw 'rectangle ${ox + 8},${oy + 12} ${ox + 23},${oy + 25}'`
      // Head (skin)
      cmd += ` -fill '#f0d0a0' -draw 'circle ${ox + 16},${oy + 9} ${ox + 16},${oy + 2}'`
      // Hat (red)
      cmd += ` -fill '#e04040' -draw 'rectangle ${ox + 8},${oy + 1} ${ox + 23},${oy + 6}'`
      // Eyes
      cmd += ` -fill '#000000' -draw 'rectangle ${ox + 12},${oy + 8} ${ox + 13},${oy + 9}'`
      cmd += ` -fill '#000000' -draw 'rectangle ${ox + 18},${oy + 8} ${ox + 19},${oy + 9}'`
      // Feet (with shift for animation)
      cmd += ` -fill '#333333' -draw 'rectangle ${ox + 9 + shift},${oy + 26} ${ox + 14 + shift},${oy + 29}'`
      cmd += ` -fill '#333333' -draw 'rectangle ${ox + 17 - shift},${oy + 26} ${ox + 22 - shift},${oy + 29}'`
    }
  }

  cmd += ` "${out}"`
  run(cmd)
}

// ─── 6. Interior Tileset (programmatic) ───────────────────────────────────────

function generateInteriorTileset() {
  const out = path.join(ASSETS, 'tilesets/interior.png')
  if (fs.existsSync(out)) {
    console.log('\n[8/8] interior.png already exists, skipping (delete to regenerate)')
    return
  }
  console.log('\n[8/8] Generating interior.png (272×16, 17 tiles of 16×16) ...')
  ensureDir(path.dirname(out))

  // 17 tiles: empty(0), wood-floor(1), stone-floor(2), carpet(3),
  // wall-top(4), wall-mid(5), wall-base(6), exterior(7),
  // door-top(8), door-side(9), window(10), stairs-l(11), stairs-r(12),
  // ladder(13), railing(14), roof-l(15), roof-r(16)
  const tileCount = 17
  const tileW = 16

  let cmd = `magick -size ${tileCount * tileW}x${tileW} xc:none`

  // Tile 0: empty (transparent) — nothing to draw

  // Tile 1: wood floor (warm brown)
  const t1 = 1 * tileW
  cmd += ` -fill '#8B7355' -draw 'rectangle ${t1},0 ${t1 + 15},15'`
  cmd += ` -fill '#7A6345' -draw 'rectangle ${t1},7 ${t1 + 15},8'`
  cmd += ` -fill '#6B5335' -draw 'rectangle ${t1},0 ${t1 + 15},1'`

  // Tile 2: stone floor (gray)
  const t2 = 2 * tileW
  cmd += ` -fill '#808080' -draw 'rectangle ${t2},0 ${t2 + 15},15'`
  cmd += ` -fill '#707070' -draw 'rectangle ${t2 + 7},0 ${t2 + 8},15'`
  cmd += ` -fill '#707070' -draw 'rectangle ${t2},7 ${t2 + 15},8'`

  // Tile 3: carpet (soft red/blue)
  const t3 = 3 * tileW
  cmd += ` -fill '#8B4444' -draw 'rectangle ${t3},0 ${t3 + 15},15'`
  cmd += ` -fill '#9B5555' -draw 'rectangle ${t3 + 2},2 ${t3 + 13},13'`

  // Tile 4: wall top (molding)
  const t4 = 4 * tileW
  cmd += ` -fill '#5a5a6a' -draw 'rectangle ${t4},0 ${t4 + 15},15'`
  cmd += ` -fill '#7a7a8a' -draw 'rectangle ${t4},12 ${t4 + 15},15'`

  // Tile 5: wall mid (repeatable)
  const t5 = 5 * tileW
  cmd += ` -fill '#4a4a5a' -draw 'rectangle ${t5},0 ${t5 + 15},15'`

  // Tile 6: wall base (baseboard)
  const t6 = 6 * tileW
  cmd += ` -fill '#4a4a5a' -draw 'rectangle ${t6},0 ${t6 + 15},11'`
  cmd += ` -fill '#6B5335' -draw 'rectangle ${t6},12 ${t6 + 15},15'`

  // Tile 7: exterior wall (dark brick)
  const t7 = 7 * tileW
  cmd += ` -fill '#3a3a3a' -draw 'rectangle ${t7},0 ${t7 + 15},15'`
  cmd += ` -fill '#444444' -draw 'rectangle ${t7},0 ${t7 + 7},7'`
  cmd += ` -fill '#444444' -draw 'rectangle ${t7 + 8},8 ${t7 + 15},15'`

  // Tile 8: door frame top
  const t8 = 8 * tileW
  cmd += ` -fill '#a89070' -draw 'rectangle ${t8},8 ${t8 + 15},15'`
  cmd += ` -fill '#987060' -draw 'rectangle ${t8 + 3},10 ${t8 + 12},15'`

  // Tile 9: door frame side
  const t9 = 9 * tileW
  cmd += ` -fill '#a89070' -draw 'rectangle ${t9},0 ${t9 + 4},15'`
  cmd += ` -fill '#a89070' -draw 'rectangle ${t9 + 11},0 ${t9 + 15},15'`

  // Tile 10: window
  const t10 = 10 * tileW
  cmd += ` -fill '#4a4a5a' -draw 'rectangle ${t10},0 ${t10 + 15},15'`
  cmd += ` -fill '#88BBDD' -draw 'rectangle ${t10 + 2},2 ${t10 + 13},13'`
  cmd += ` -fill '#6699BB' -draw 'rectangle ${t10 + 7},2 ${t10 + 8},13'`
  cmd += ` -fill '#6699BB' -draw 'rectangle ${t10 + 2},7 ${t10 + 13},8'`

  // Tile 11: stairs left
  const t11 = 11 * tileW
  cmd += ` -fill '#8B7355' -draw 'rectangle ${t11},8 ${t11 + 7},15'`
  cmd += ` -fill '#8B7355' -draw 'rectangle ${t11 + 8},0 ${t11 + 15},15'`

  // Tile 12: stairs right
  const t12 = 12 * tileW
  cmd += ` -fill '#8B7355' -draw 'rectangle ${t12},0 ${t12 + 7},15'`
  cmd += ` -fill '#8B7355' -draw 'rectangle ${t12 + 8},8 ${t12 + 15},15'`

  // Tile 13: ladder
  const t13 = 13 * tileW
  cmd += ` -fill '#AA8855' -draw 'rectangle ${t13 + 2},0 ${t13 + 4},15'`
  cmd += ` -fill '#AA8855' -draw 'rectangle ${t13 + 11},0 ${t13 + 13},15'`
  cmd += ` -fill '#AA8855' -draw 'rectangle ${t13 + 2},3 ${t13 + 13},4'`
  cmd += ` -fill '#AA8855' -draw 'rectangle ${t13 + 2},8 ${t13 + 13},9'`
  cmd += ` -fill '#AA8855' -draw 'rectangle ${t13 + 2},13 ${t13 + 13},14'`

  // Tile 14: railing
  const t14 = 14 * tileW
  cmd += ` -fill '#AAAAAA' -draw 'rectangle ${t14 + 7},0 ${t14 + 8},15'`
  cmd += ` -fill '#888888' -draw 'rectangle ${t14},2 ${t14 + 15},3'`
  cmd += ` -fill '#888888' -draw 'rectangle ${t14},12 ${t14 + 15},13'`

  // Tile 15: roof left slope
  const t15 = 15 * tileW
  cmd += ` -fill '#AA4444' -draw 'rectangle ${t15 + 8},0 ${t15 + 15},15'`
  cmd += ` -fill '#AA4444' -draw 'rectangle ${t15 + 4},4 ${t15 + 15},15'`
  cmd += ` -fill '#AA4444' -draw 'rectangle ${t15},8 ${t15 + 15},15'`

  // Tile 16: roof right slope
  const t16 = 16 * tileW
  cmd += ` -fill '#AA4444' -draw 'rectangle ${t16},0 ${t16 + 7},15'`
  cmd += ` -fill '#AA4444' -draw 'rectangle ${t16},4 ${t16 + 11},15'`
  cmd += ` -fill '#AA4444' -draw 'rectangle ${t16},8 ${t16 + 15},15'`

  cmd += ` "${out}"`
  run(cmd)
}

// ─── 7. Audio (synthetic via ffmpeg) ──────────────────────────────────────────

function generateAudio() {
  const audioDir = path.join(ASSETS, 'audio')
  console.log('\n[bonus] Generating placeholder audio files ...')
  ensureDir(audioDir)

  // Use ffmpeg sine wave generator + libopus encoder (available on macOS)
  const sounds = [
    { name: 'footstep', dur: 0.15, freq: 200 },
    { name: 'typing', dur: 0.4, freq: 800 },
    { name: 'snore', dur: 1.5, freq: 80 },
    { name: 'jump', dur: 0.2, freq: 500 },
    { name: 'celebrate', dur: 0.8, freq: 600 },
    { name: 'error', dur: 0.3, freq: 150 },
  ]

  for (const s of sounds) {
    const out = path.join(audioDir, `${s.name}.ogg`)
    if (fs.existsSync(out)) {
      console.log(`  → ${s.name}.ogg already exists, skipping`)
      continue
    }
    try {
      run(
        `ffmpeg -y -f lavfi -i "sine=frequency=${s.freq}:duration=${s.dur}" -c:a libopus "${out}" 2>/dev/null`
      )
    } catch {
      console.log(`  ⚠ Skipped ${s.name}.ogg (ffmpeg failed)`)
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  Watch Claw — Placeholder Asset Generator       ║')
  console.log('╚══════════════════════════════════════════════════╝')

  generateConfetti()
  generateZzz()
  generateSpark()
  generateEmotions()
  generateFurniture()
  generateTilemap()
  generateCharacterSpritesheet()
  generateInteriorTileset()
  generateAudio()

  console.log('\n✅ All placeholder assets generated!')
  console.log('   Replace with real art when ready (same filenames).\n')
}

main()
