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
    format: 'text',
    maxFileSize: null,
    maxFiles: 5,
}

const ALL_LEVELS = ['log', 'debug', 'error', 'warn', 'info', 'crit']

class Logger {
    static #config = { ...DEFAULT_CONFIG }
    static #streams = new Map()
    static #dirCreated = new Set()
    static #bytesWritten = new Map()

    static setConfig(config) {
        Logger.#config = { ...Logger.#config, ...config }
    }

    static getConfig() {
        return { ...Logger.#config }
    }

    static async closeFds() {
        const promises = []
        for (const stream of Logger.#streams.values()) {
            promises.push(new Promise((resolve) => stream.end(resolve)))
        }
        await Promise.all(promises)
        Logger.#streams.clear()
        Logger.#dirCreated.clear()
        Logger.#bytesWritten.clear()
    }

    static async flush() {
        const promises = []
        for (const stream of Logger.#streams.values()) {
            promises.push(new Promise((resolve) => stream.write('', resolve)))
        }
        await Promise.all(promises)
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

    static #getStream(logDir, level) {
        const filePath = path.join(logDir, `${level}.log`)
        if (Logger.#streams.has(filePath)) return { stream: Logger.#streams.get(filePath), filePath }

        if (!Logger.#dirCreated.has(logDir)) {
            fs.mkdirSync(logDir, { recursive: true })
            Logger.#dirCreated.add(logDir)
        }

        // Open sync to ensure file exists immediately (needed for rotation renames)
        const fd = fs.openSync(filePath, 'a')
        const initialSize = fs.fstatSync(fd).size
        Logger.#bytesWritten.set(filePath, initialSize)

        const stream = fs.createWriteStream(filePath, { fd, autoClose: true })
        stream.on('error', () => {})
        Logger.#streams.set(filePath, stream)
        return { stream, filePath }
    }

    static #rotate(logDir, level) {
        const basePath = path.join(logDir, `${level}.log`)
        const stream = Logger.#streams.get(basePath)
        if (stream) {
            stream.end()
            Logger.#streams.delete(basePath)
        }

        const { maxFiles } = Logger.#config
        const oldest = path.join(logDir, `${level}.${maxFiles}.log`)
        try {
            fs.unlinkSync(oldest)
        } catch {
            // ok if doesn't exist
        }

        for (let i = maxFiles - 1; i >= 1; i--) {
            const from = path.join(logDir, `${level}.${i}.log`)
            const to = path.join(logDir, `${level}.${i + 1}.log`)
            try {
                fs.renameSync(from, to)
            } catch {
                // ok if doesn't exist
            }
        }

        try {
            fs.renameSync(basePath, path.join(logDir, `${level}.1.log`))
        } catch {
            // ok if doesn't exist
        }

        Logger.#bytesWritten.set(basePath, 0)
    }

    static #formatLine(level, prefix, argsStr, channelName) {
        if (Logger.#config.format === 'json') {
            const obj = {
                timestamp: new Date().toISOString(),
                level,
                prefix,
                message: argsStr,
            }
            if (channelName) obj.channel = channelName
            return JSON.stringify(obj)
        }
        const timestamp = Logger.#formatTimestamp()
        const levelUpper = level.toUpperCase()
        return `[${timestamp}] (${prefix}) [${levelUpper}] ${argsStr}`
    }

    static #write(level, prefix, args, channelName = null) {
        if (!Logger.#config.levels.includes(level)) return

        const argsStr = Logger.#formatArgs(args)
        const line = Logger.#formatLine(level, prefix, argsStr, channelName)

        if (Logger.#config.output.includes('console')) {
            if (Logger.#config.format === 'json') {
                console.log(line)
            } else if (Logger.#config.colors && process.stdout.isTTY) {
                const color = LEVEL_COLORS[level] || ''
                console.log(`${color}${line}${COLORS.reset}`)
            } else {
                console.log(line)
            }
        }

        if (Logger.#config.output.includes('file')) {
            const logDir = channelName ? path.resolve(Logger.#config.logDir, channelName) : path.resolve(Logger.#config.logDir)
            const data = `${line}\n`
            const byteLength = Buffer.byteLength(data)

            // Ensure stream exists so #bytesWritten is initialized from existing file size
            Logger.#getStream(logDir, level)

            if (Logger.#config.maxFileSize) {
                const filePath = path.join(logDir, `${level}.log`)
                const currentBytes = Logger.#bytesWritten.get(filePath) || 0
                if (currentBytes + byteLength > Logger.#config.maxFileSize) {
                    Logger.#rotate(logDir, level)
                }
            }

            // Get stream again (may be new after rotation)
            const { stream, filePath } = Logger.#getStream(logDir, level)
            stream.write(data)
            Logger.#bytesWritten.set(filePath, (Logger.#bytesWritten.get(filePath) || 0) + byteLength)
        }
    }

    static channel(channelName) {
        const bound = {}
        ALL_LEVELS.forEach((level) => {
            bound[level] = (...args) => Logger.#write(level, Logger.getConfig().prefix, args, channelName)
            bound[`p${level}`] = (prefix, ...args) => Logger.#write(level, prefix, args, channelName)
        })
        return bound
    }

    static child(prefix) {
        const bound = {}
        ALL_LEVELS.forEach((level) => {
            bound[level] = (...args) => Logger.#write(level, prefix, args)
        })
        bound.channel = (channelName) => {
            const channelBound = {}
            ALL_LEVELS.forEach((level) => {
                channelBound[level] = (...args) => Logger.#write(level, prefix, args, channelName)
            })
            return channelBound
        }
        return bound
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
