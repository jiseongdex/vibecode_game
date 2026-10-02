import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'

const ASSET_DIR = join('public', 'assets', 'players')
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const APPEARANCES = ['girl', 'boy']
const SIDES = ['front', 'back', 'left', 'right']
const FRAMES = ['a', 'b']
const ALPHA_THRESHOLD = 16
const MAX_BOTTOM_DELTA = 8
const MAX_HEIGHT_RATIO = 0.01
const INSPECT_ONLY = process.argv.includes('--baseline')
const JSON_OUTPUT = process.argv.includes('--json')

/** @typedef {{ width: number, height: number, left: number, top: number, right: number, bottom: number, visibleHeight: number }} AlphaBounds */

/** @param {number} left @param {number} above @param {number} upperLeft @returns {number} */
function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const aboveDistance = Math.abs(prediction - above)
  const upperLeftDistance = Math.abs(prediction - upperLeft)
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left
  if (aboveDistance <= upperLeftDistance) return above
  return upperLeft
}

/** @param {string} filePath @returns {AlphaBounds} */
function readPngAlphaBounds(filePath) {
  const file = readFileSync(filePath)
  if (!file.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(filePath + ': invalid PNG signature')
  }

  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  let sawIhdr = false
  let sawIend = false
  const idat = []

  for (let offset = 8; offset < file.length;) {
    if (offset + 12 > file.length) throw new Error(filePath + ': truncated PNG chunk')
    const length = file.readUInt32BE(offset)
    const type = file.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > file.length) throw new Error(filePath + ': truncated ' + type + ' chunk')
    const data = file.subarray(dataStart, dataEnd)

    if (type === 'IHDR') {
      if (sawIhdr || length !== 13) throw new Error(filePath + ': invalid IHDR')
      sawIhdr = true
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      sawIend = true
      break
    }
    offset = dataEnd + 4
  }

  if (!sawIhdr || !sawIend || idat.length === 0) {
    throw new Error(filePath + ': missing PNG data')
  }
  if (width !== 1254 || height !== 1254 || bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(filePath + ': expected 1254x1254, 8-bit RGBA, non-interlaced PNG')
  }

  const stride = width * 4
  const data = inflateSync(Buffer.concat(idat))
  if (data.length !== (stride + 1) * height) {
    throw new Error(filePath + ': unexpected decompressed data length')
  }

  let prior = Buffer.alloc(stride)
  let current = Buffer.alloc(stride)
  let offset = 0
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    const filter = data[offset]
    offset += 1
    if (filter > 4) throw new Error(filePath + ': unsupported PNG row filter ' + filter)
    for (let index = 0; index < stride; index += 1) {
      const raw = data[offset + index]
      const previousPixel = index >= 4 ? current[index - 4] : 0
      const previousRow = prior[index]
      const upperLeft = index >= 4 ? prior[index - 4] : 0
      let predictor = 0
      if (filter === 1) predictor = previousPixel
      if (filter === 2) predictor = previousRow
      if (filter === 3) predictor = Math.floor((previousPixel + previousRow) / 2)
      if (filter === 4) predictor = paethPredictor(previousPixel, previousRow, upperLeft)
      current[index] = (raw + predictor) & 255
    }
    offset += stride

    for (let x = 0; x < width; x += 1) {
      const alpha = current[x * 4 + 3]
      if ((x === 0 || x === width - 1) && (y === 0 || y === height - 1) && alpha !== 0) {
        throw new Error(filePath + ': PNG canvas corner is not transparent')
      }
      if (alpha < ALPHA_THRESHOLD) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
    ;[prior, current] = [current, prior]
  }

  if (right < left || bottom < top) {
    throw new Error(filePath + ': no visible alpha pixels')
  }
  return { width, height, left, top, right, bottom, visibleHeight: bottom - top + 1 }
}

const rows = []
const boundsRows = []
let failures = 0

/** @param {'girl'|'boy'} appearance @param {'front'|'back'|'left'|'right'} side @param {'a'|'b'} frame @returns {boolean} */
function checkFramePair(appearance, side, frame) {
  const baseName = 'player-' + appearance + '-' + side + '.png'
  const walkName = 'player-' + appearance + '-' + side + '-walk-' + frame + '.png'
  const basePath = join(ASSET_DIR, baseName)
  const walkPath = join(ASSET_DIR, walkName)
  const baseBounds = readPngAlphaBounds(basePath)
  const walkBounds = readPngAlphaBounds(walkPath)
  const heightDelta = walkBounds.visibleHeight - baseBounds.visibleHeight
  const bottomDelta = walkBounds.bottom - baseBounds.bottom
  const passed = Math.abs(heightDelta) <= baseBounds.visibleHeight * MAX_HEIGHT_RATIO &&
    Math.abs(bottomDelta) <= MAX_BOTTOM_DELTA
  rows.push({
    asset: appearance + '-' + side + '-' + frame,
    baseHeight: baseBounds.visibleHeight,
    walkHeight: walkBounds.visibleHeight,
    heightDelta,
    bottomDelta,
    result: passed ? 'ok' : 'FAIL',
  })
  boundsRows.push({ appearance, side, frame, baseBounds, walkBounds })
  if (!passed) failures += 1
  return passed
}

try {
  for (const appearance of APPEARANCES) {
    for (const side of SIDES) {
      for (const frame of FRAMES) checkFramePair(appearance, side, frame)
      const a = readFileSync(join(ASSET_DIR, 'player-' + appearance + '-' + side + '-walk-a.png'))
      const b = readFileSync(join(ASSET_DIR, 'player-' + appearance + '-' + side + '-walk-b.png'))
      if (a.equals(b)) {
        console.error(appearance + '-' + side + ': walk A and B are byte-identical')
        failures += 1
      }
    }
  }
  if (JSON_OUTPUT) console.log(JSON.stringify(boundsRows))
  else console.table(rows)
  if (failures > 0) {
    if (!JSON_OUTPUT) console.error(failures + ' player walk frame checks failed')
    if (!INSPECT_ONLY) process.exitCode = 1
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
