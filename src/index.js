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
    static #fds = new Map()
    static #dirCreated = new Set()

    static setConfig(config) {
        Logger.#config = { ...Logger.#config, ...config }
    }

    static getConfig() {
        return { ...Logger.#config }
    }

    static closeFds() {
        for (const fd of Logger.#fds.values()) {
            try {
                fs.closeSync(fd)
            } catch {
                // ignore close errors
            }
        }
        Logger.#fds.clear()
        Logger.#dirCreated.clear()
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

    static #getFd(logDir, level) {
        const filePath = path.join(logDir, `${level}.log`)
        if (Logger.#fds.has(filePath)) return Logger.#fds.get(filePath)

        if (!Logger.#dirCreated.has(logDir)) {
            fs.mkdirSync(logDir, { recursive: true })
            Logger.#dirCreated.add(logDir)
        }

        const fd = fs.openSync(filePath, 'a')
        Logger.#fds.set(filePath, fd)
        return fd
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
            const fd = Logger.#getFd(logDir, level)
            fs.writeSync(fd, `${plainLine}\n`)
        }
    }

    static #writeChannel(channelName, level, prefix, args) {
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
            const logDir = path.resolve(Logger.#config.logDir, channelName)
            const fd = Logger.#getFd(logDir, level)
            fs.writeSync(fd, `${plainLine}\n`)
        }
    }

    static channel(channelName) {
        const bound = {}
        ALL_LEVELS.forEach((level) => {
            bound[level] = (...args) => Logger.#writeChannel(channelName, level, Logger.getConfig().prefix, args)
            bound[`p${level}`] = (prefix, ...args) => Logger.#writeChannel(channelName, level, prefix, args)
        })
        return bound
    }

    static child(prefix) {
        const bound = {}
        ALL_LEVELS.forEach((level) => {
            bound[level] = (...args) => Logger._write(level, prefix, args)
        })
        bound.channel = (channelName) => {
            const channelBound = {}
            ALL_LEVELS.forEach((level) => {
                channelBound[level] = (...args) => Logger.#writeChannel(channelName, level, prefix, args)
            })
            return channelBound
        }
        return bound
    }

    static _write(level, prefix, args) {
        return Logger.#write(level, prefix, args)
    }

    static _writeChannel(channelName, level, prefix, args) {
        return Logger.#writeChannel(channelName, level, prefix, args)
    }
}

ALL_LEVELS.forEach((level) => {
    Logger[level] = (...args) => Logger._write(level, Logger.getConfig().prefix, args)
    Logger[`p${level}`] = (prefix, ...args) => Logger._write(level, prefix, args)
})

export { Logger }
export default Logger
