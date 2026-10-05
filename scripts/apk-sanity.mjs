import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const EXPECT_PKG = 'io.github.st0nkingst1ngray.prompttrapdoor'
const apk = path.resolve('android/app/build/outputs/apk/debug/app-debug.apk')

if (!fs.existsSync(apk)) {
  console.error(`APK missing: ${apk}`)
  process.exit(1)
}
const size = fs.statSync(apk).size
if (size < 50_000) {
  console.error(`APK too small (${size} bytes): ${apk}`)
  process.exit(1)
}

execFileSync('unzip', ['-t', apk], { stdio: 'inherit' })
const listing = execFileSync('unzip', ['-l', apk], { encoding: 'utf8' })
if (!listing.includes('AndroidManifest.xml')) {
  console.error('APK zip has no AndroidManifest.xml')
  process.exit(1)
}
if (!/classes\d*\.dex/.test(listing)) {
  console.error('APK zip has no classes.dex')
  process.exit(1)
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '/opt/android-sdk'
const buildTools = path.join(sdk, 'build-tools')
const versions = fs.existsSync(buildTools) ? fs.readdirSync(buildTools).sort().reverse() : []
const aapt = versions.map((v) => path.join(buildTools, v, 'aapt')).find((p) => fs.existsSync(p))
if (!aapt) {
  console.error(`aapt not found under ${buildTools}`)
  process.exit(1)
}
const badging = execFileSync(aapt, ['dump', 'badging', apk], { encoding: 'utf8' })
const pkg = badging.match(/package: name='([^']+)'/)?.[1]
const versionName = badging.match(/versionName='([^']+)'/)?.[1]
const versionCode = badging.match(/versionCode='([^']+)'/)?.[1]
if (pkg !== EXPECT_PKG) {
  console.error(`package mismatch: got ${pkg}, expected ${EXPECT_PKG}`)
  console.error(badging.split('\n').slice(0, 5).join('\n'))
  process.exit(1)
}
console.log(JSON.stringify({ apk, bytes: size, package: pkg, versionName, versionCode }, null, 2))
