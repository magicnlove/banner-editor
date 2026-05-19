/**
 * api/fonts/ TTF → woff2 변환
 * 사용: node scripts/convert-fonts.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import ttf2woff2 from 'ttf2woff2'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '..', 'api', 'fonts')

/** @type {Array<{ input: string; output: string }>} */
const TARGETS = [
  { input: 'HanwhaR.ttf', output: 'HanwhaR.woff2' },
  { input: 'HGGGothicssi_40g.ttf', output: 'HGGGothicssi_40g.woff2' },
  { input: 'HGGGothicssi_99g.ttf', output: 'HGGGothicssi_99g.woff2' },
]

for (const { input, output } of TARGETS) {
  const inputPath = join(FONTS_DIR, input)
  const outputPath = join(FONTS_DIR, output)

  if (!existsSync(inputPath)) {
    console.error(`Missing: ${inputPath}`)
    process.exitCode = 1
    continue
  }

  const ttf = readFileSync(inputPath)
  const woff2 = ttf2woff2(ttf)
  writeFileSync(outputPath, woff2)

  console.log(`Converted: ${input} → ${output} (${woff2.length} bytes)`)
}

if (process.exitCode === 1) {
  process.exit(1)
}

console.log('Done.')
