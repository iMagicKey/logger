import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import { LEVEL_COLORS, COLORS } from './modules/colors.js'

const DEFAULT_CONFIG = {
    prefix: 'APP',
    output: ['console'],
    logDir: './logs',
    colors: true,
    levels: ['log', 'debug', 'error', 'warn', 'info', 'crit'],
}

const ALL_LEVELS = ['log', 'debug', 'error', 'warn', 'info', 'crit']

class Logger {
    static #config = { ...DEFAULT_CONFIG }

    static setConfig(config) {
        Logger.#config = { ...Logger.#config, ...config }
    }

    static getConfig() {
        return { ...Logger.#config }
    }

    static #formatTimestamp() {
        const now = new Date()
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')
        const ms = String(now.getMilliseconds()).padStart(3, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`
    }

    static #formatArgs(args) {
        return args.map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 4 }))).join(' ')
    }

    static #write(level, prefix, args) {
        if (!Logger.#config.levels.includes(level)) return

        const timestamp = Logger.#formatTimestamp()
        const levelUpper = level.toUpperCase()
        const argsStr = Logger.#formatArgs(args)
        const plainLine = `[${timestamp}] (${prefix}) [${levelUpper}] ${argsStr}`

        if (Logger.#config.output.includes('console')) {
            if (Logger.#config.colors && process.stdout.isTTY) {
                const color = LEVEL_COLORS[level] || ''
                console.log(`${color}${plainLine}${COLORS.reset}`)
            } else {
                console.log(plainLine)
            }
        }

        if (Logger.#config.output.includes('file')) {
            const logDir = path.resolve(Logger.#config.logDir)
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true })
            }
            fs.appendFileSync(path.join(logDir, `${level}.log`), `${plainLine}\n`)
        }
    }

    static _write(level, prefix, args) {
        return Logger.#write(level, prefix, args)
    }
}

ALL_LEVELS.forEach((level) => {
    Logger[level] = (...args) => Logger._write(level, Logger.getConfig().prefix, args)
    Logger[`p${level}`] = (prefix, ...args) => Logger._write(level, prefix, args)
})

export { Logger }
export default Logger
