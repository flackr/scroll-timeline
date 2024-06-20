import { resolve } from 'path'
import { defineConfig } from 'vite'
import { buildConfig } from './vite.config.common'

export default defineConfig(buildConfig(resolve(__dirname, 'src/index.js'), 'scroll-timeline'));