import fs from 'node:fs'

const mode = process.argv[2]
if (mode !== 'pages' && mode !== 'android') {
  console.error('usage: node scripts/web-base-smoke.mjs <pages|android>')
  process.exit(2)
}

const htmlPath = 'dist/index.html'
if (!fs.existsSync(htmlPath)) {
  console.error(`missing ${htmlPath} — run the matching build first`)
  process.exit(1)
}
const html = fs.readFileSync(htmlPath, 'utf8')
const assetRefs = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((m) => m[1])
if (assetRefs.length < 2) {
  console.error('expected js and css asset refs in dist/index.html')
  console.error(html)
  process.exit(1)
}
for (const ref of assetRefs) {
  const rel = ref.replace(/^\/prompt-trapdoor\//, '').replace(/^\.\//, '')
  if (!fs.existsSync(`dist/${rel}`)) {
    console.error(`missing built asset dist/${rel}`)
    process.exit(1)
  }
}

if (mode === 'pages') {
  const bad = assetRefs.filter((ref) => !ref.startsWith('/prompt-trapdoor/assets/'))
  if (bad.length) {
    console.error('Pages build must keep base /prompt-trapdoor/', bad)
    process.exit(1)
  }
} else {
  const bad = assetRefs.filter((ref) => !ref.startsWith('./assets/'))
  if (bad.length) {
    console.error('Capacitor build must use relative ./assets/', bad)
    process.exit(1)
  }
}

console.log(`web smoke ok (${mode}): ${assetRefs.join(', ')}`)
