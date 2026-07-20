import sharp from 'sharp'

export type GeneratedImage = {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

type Swatch = { accent: string; from: string; to: string }

const SWATCHES: Record<string, Swatch> = {
  amber: { accent: '#7c2d12', from: '#f59e0b', to: '#b45309' },
  cobalt: { accent: '#0b1d51', from: '#3b82f6', to: '#1e3a8a' },
  forest: { accent: '#052e1a', from: '#34d399', to: '#065f46' },
  magenta: { accent: '#500724', from: '#f472b6', to: '#9d174d' },
  slate: { accent: '#020617', from: '#94a3b8', to: '#1e293b' },
  teal: { accent: '#042f2e', from: '#2dd4bf', to: '#115e59' },
  violet: { accent: '#2e1065', from: '#a78bfa', to: '#5b21b6' },
}

export type SwatchName = keyof typeof SWATCHES

// Deterministic so re-seeding a wiped database reproduces byte-identical media.
const rng = (seed: number) => {
  let state = seed * 2654435761
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const shapes = (width: number, height: number, swatch: Swatch, seed: number): string => {
  const next = rng(seed)
  const parts: string[] = []
  for (let i = 0; i < 7; i++) {
    const r = (0.12 + next() * 0.3) * Math.min(width, height)
    parts.push(
      `<circle cx="${(next() * width).toFixed(0)}" cy="${(next() * height).toFixed(0)}" r="${r.toFixed(0)}" fill="${swatch.accent}" opacity="${(0.06 + next() * 0.14).toFixed(3)}"/>`,
    )
  }
  for (let i = 0; i < 3; i++) {
    const y = (next() * height).toFixed(0)
    parts.push(
      `<rect x="0" y="${y}" width="${width}" height="${(2 + next() * 6).toFixed(0)}" fill="#ffffff" opacity="${(0.05 + next() * 0.1).toFixed(3)}"/>`,
    )
  }
  return parts.join('')
}

const svg = (width: number, height: number, swatch: Swatch, seed: number, label: string): string => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${swatch.from}"/>
      <stop offset="100%" stop-color="${swatch.to}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  ${shapes(width, height, swatch, seed)}
  <text x="${width / 2}" y="${height / 2}" fill="#ffffff" fill-opacity="0.82" font-family="Helvetica, Arial, sans-serif"
        font-size="${Math.round(Math.min(width, height) * 0.09)}" font-weight="700" letter-spacing="2"
        text-anchor="middle" dominant-baseline="central">${label}</text>
</svg>`

/**
 * Synthesizes demo imagery at seed time instead of committing binaries — `dev/media`
 * is gitignored, so the playground stays weightless and reproducible offline.
 */
export const generateImage = async (args: {
  height?: number
  label: string
  name: string
  seed: number
  swatch: SwatchName
  width?: number
}): Promise<GeneratedImage> => {
  const { height = 900, label, name, seed, swatch, width = 1600 } = args
  const source = svg(width, height, SWATCHES[swatch], seed, label)
  const data = await sharp(Buffer.from(source)).jpeg({ mozjpeg: true, quality: 82 }).toBuffer()
  return { name, data, mimetype: 'image/jpeg', size: data.byteLength }
}
