const { mkdirSync } = require('node:fs')
const { dirname, resolve } = require('node:path')
const esbuild = require('esbuild')

async function main() {
  const projectRoot = resolve(__dirname, '..')
  const entry = resolve(projectRoot, 'bridge', 'server.ts')
  const outfile = resolve(projectRoot, 'build', 'bridge', 'server.cjs')

  mkdirSync(dirname(outfile), { recursive: true })

  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: false,
    minify: false,
    legalComments: 'none',
    external: ['electron'],
  })

  process.stdout.write(`[build-electron] Bundled Bridge Server to ${outfile}\n`)
}

main().catch((error) => {
  process.stderr.write(`[build-electron] Failed: ${error.stack || error}\n`)
  process.exit(1)
})
