import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { expect } from 'chai'
import { Logger } from '../src/index.js'

const ALL_LEVELS = ['log', 'debug', 'error', 'warn', 'info', 'crit']

// Capture console.log output during a synchronous function call
function captureConsoleLog(fn) {
    const captured = []
    const origLog = console.log
    console.log = (...args) => captured.push(args.join(' '))
    try {
        fn()
    } finally {
        console.log = origLog
    }
    return captured
}

describe('Logger.setConfig / Logger.getConfig', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('getConfig returns default config on fresh state', () => {
        Logger.setConfig({
            prefix: 'APP',
            output: ['console'],
            logDir: './logs',
            colors: true,
            levels: ['log', 'debug', 'error', 'warn', 'info', 'crit'],
        })
        const config = Logger.getConfig()
        expect(config).to.have.property('prefix', 'APP')
        expect(config.output).to.deep.equal(['console'])
        expect(config).to.have.property('logDir', './logs')
        expect(config).to.have.property('colors', true)
        expect(config.levels).to.deep.equal(['log', 'debug', 'error', 'warn', 'info', 'crit'])
    })

    it('setConfig merges partial config', () => {
        Logger.setConfig({ prefix: 'MyApp' })
        expect(Logger.getConfig().prefix).to.equal('MyApp')
        // other fields remain unchanged
        expect(Logger.getConfig().output).to.deep.equal(['console'])
    })

    it('setConfig overrides output array', () => {
        Logger.setConfig({ output: ['file'] })
        expect(Logger.getConfig().output).to.deep.equal(['file'])
    })

    it('getConfig returns a copy — mutations do not affect internal state', () => {
        const config = Logger.getConfig()
        config.prefix = 'MUTATED'
        expect(Logger.getConfig().prefix).to.not.equal('MUTATED')
    })
})

describe('Logger level methods exist and are callable', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ output: ['console'], colors: false })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    ALL_LEVELS.forEach((level) => {
        it(`Logger.${level} is a function`, () => {
            expect(Logger[level]).to.be.a('function')
        })

        it(`Logger.p${level} is a function`, () => {
            expect(Logger[`p${level}`]).to.be.a('function')
        })

        it(`Logger.${level} can be called without error`, () => {
            expect(() => Logger[level]('test message')).to.not.throw()
        })

        it(`Logger.p${level} can be called with prefix without error`, () => {
            expect(() => Logger[`p${level}`]('PREFIX', 'test message')).to.not.throw()
        })
    })
})

describe('Console output', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ prefix: 'TEST', output: ['console'], colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('outputs a line containing the log level', () => {
        const lines = captureConsoleLog(() => Logger.log('hello'))
        expect(lines).to.have.lengthOf(1)
        expect(lines[0]).to.include('[LOG]')
    })

    it('outputs a line containing the global prefix', () => {
        const lines = captureConsoleLog(() => Logger.info('msg'))
        expect(lines[0]).to.include('(TEST)')
    })

    it('p{level} uses the per-call prefix, not the global prefix', () => {
        Logger.setConfig({ prefix: 'GLOBAL' })
        const lines = captureConsoleLog(() => Logger.plog('LOCAL', 'msg'))
        expect(lines[0]).to.include('(LOCAL)')
        expect(lines[0]).to.not.include('(GLOBAL)')
    })

    it('outputs line for each level with correct label', () => {
        const levelLabels = {
            log: '[LOG]',
            debug: '[DEBUG]',
            info: '[INFO]',
            warn: '[WARN]',
            error: '[ERROR]',
            crit: '[CRIT]',
        }
        ALL_LEVELS.forEach((level) => {
            const lines = captureConsoleLog(() => Logger[level]('msg'))
            expect(lines[0]).to.include(levelLabels[level])
        })
    })

    it('contains timestamp in expected format', () => {
        const lines = captureConsoleLog(() => Logger.log('ts test'))
        // Format: [YYYY-MM-DD HH:mm:ss.mmm]
        expect(lines[0]).to.match(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/)
    })

    it('contains the message string', () => {
        const lines = captureConsoleLog(() => Logger.log('hello world'))
        expect(lines[0]).to.include('hello world')
    })

    it('does not output when output is set to file only', () => {
        Logger.setConfig({ output: ['file'] })
        const lines = captureConsoleLog(() => Logger.log('silent'))
        expect(lines).to.have.lengthOf(0)
    })
})

describe('File output', () => {
    let tmpDir
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-test-'))
        Logger.setConfig({ prefix: 'FILETEST', output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
        // Clean up temp directory
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore cleanup errors
        }
    })

    it('creates a log file for each level called', () => {
        Logger.log('file message')
        const logFile = path.join(tmpDir, 'log.log')
        expect(fs.existsSync(logFile)).to.equal(true)
    })

    it('writes the correct content to the log file', () => {
        Logger.error('something went wrong')
        const content = fs.readFileSync(path.join(tmpDir, 'error.log'), 'utf8')
        expect(content).to.include('something went wrong')
        expect(content).to.include('[ERROR]')
        expect(content).to.include('(FILETEST)')
    })

    it('appends multiple lines to the same file', () => {
        Logger.warn('first')
        Logger.warn('second')
        const content = fs.readFileSync(path.join(tmpDir, 'warn.log'), 'utf8')
        const lines = content.trim().split('\n')
        expect(lines).to.have.lengthOf(2)
        expect(lines[0]).to.include('first')
        expect(lines[1]).to.include('second')
    })

    it('file output contains timestamp', () => {
        Logger.info('timestamp check')
        const content = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(content).to.match(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/)
    })

    it('file output does not contain ANSI color codes', () => {
        Logger.crit('critical')
        const content = fs.readFileSync(path.join(tmpDir, 'crit.log'), 'utf8')
        // ANSI escape sequences start with ESC (\x1b)
        expect(content).to.not.include('\x1b')
    })

    it('creates the logDir if it does not exist', () => {
        const nestedDir = path.join(tmpDir, 'nested', 'logs')
        Logger.setConfig({ logDir: nestedDir })
        Logger.debug('nested dir test')
        expect(fs.existsSync(path.join(nestedDir, 'debug.log'))).to.equal(true)
    })

    it('p{level} uses per-call prefix in file output', () => {
        Logger.pinfo('CUSTOM', 'per-call prefix test')
        const content = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(content).to.include('(CUSTOM)')
    })

    it('writes correct log files for each level', () => {
        ALL_LEVELS.forEach((level) => Logger[level](`${level} message`))
        ALL_LEVELS.forEach((level) => {
            const logFile = path.join(tmpDir, `${level}.log`)
            expect(fs.existsSync(logFile), `${level}.log should exist`).to.equal(true)
            const content = fs.readFileSync(logFile, 'utf8')
            expect(content).to.include(`${level} message`)
        })
    })
})

describe('Level filtering', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ output: ['console'], colors: false })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('only logs allowed levels when levels is restricted', () => {
        Logger.setConfig({ levels: ['error', 'crit'] })
        const logLines = captureConsoleLog(() => Logger.log('should not appear'))
        const errorLines = captureConsoleLog(() => Logger.error('should appear'))
        expect(logLines).to.have.lengthOf(0)
        expect(errorLines).to.have.lengthOf(1)
    })

    it('logs nothing when levels is empty array', () => {
        Logger.setConfig({ levels: [] })
        ALL_LEVELS.forEach((level) => {
            const lines = captureConsoleLog(() => Logger[level]('msg'))
            expect(lines).to.have.lengthOf(0)
        })
    })

    it('logs all levels when levels contains all', () => {
        Logger.setConfig({ levels: ALL_LEVELS })
        ALL_LEVELS.forEach((level) => {
            const lines = captureConsoleLog(() => Logger[level]('msg'))
            expect(lines).to.have.lengthOf(1)
        })
    })
})

describe('Non-string argument inspection', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ output: ['console'], colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('inspects objects using util.inspect', () => {
        const lines = captureConsoleLog(() => Logger.log({ key: 'value' }))
        expect(lines[0]).to.include('key')
        expect(lines[0]).to.include('value')
    })

    it('inspects arrays', () => {
        const lines = captureConsoleLog(() => Logger.log([1, 2, 3]))
        expect(lines[0]).to.include('1')
        expect(lines[0]).to.include('2')
        expect(lines[0]).to.include('3')
    })

    it('inspects null and undefined', () => {
        const nullLines = captureConsoleLog(() => Logger.log(null))
        const undefLines = captureConsoleLog(() => Logger.log(undefined))
        expect(nullLines[0]).to.include('null')
        expect(undefLines[0]).to.include('undefined')
    })

    it('inspects numbers', () => {
        const lines = captureConsoleLog(() => Logger.log(42))
        expect(lines[0]).to.include('42')
    })

    it('handles multiple mixed arguments', () => {
        const lines = captureConsoleLog(() => Logger.log('message:', { x: 1 }, 'end'))
        expect(lines[0]).to.include('message:')
        expect(lines[0]).to.include('x: 1')
        expect(lines[0]).to.include('end')
    })
})

describe('Colors disabled', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ output: ['console'], colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('output does not contain ANSI codes when colors is false', () => {
        const lines = captureConsoleLog(() => Logger.crit('no color'))
        expect(lines[0]).to.not.include('\x1b')
    })

    it('output still contains log content when colors is false', () => {
        const lines = captureConsoleLog(() => Logger.warn('plain output'))
        expect(lines[0]).to.include('plain output')
        expect(lines[0]).to.include('[WARN]')
    })
})

describe('Output to both console and file', () => {
    let tmpDir
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-both-'))
        Logger.setConfig({ prefix: 'BOTH', output: ['console', 'file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore cleanup errors
        }
    })

    it('writes to both console and file simultaneously', () => {
        const lines = captureConsoleLog(() => Logger.info('dual output'))
        const content = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(lines).to.have.lengthOf(1)
        expect(lines[0]).to.include('dual output')
        expect(content).to.include('dual output')
    })
})

describe('Named channels', () => {
    let tmpDir
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.closeFds()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-channel-'))
        Logger.setConfig({ prefix: 'APP', output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore
        }
    })

    it('channel writes to a subdirectory named after the channel', () => {
        Logger.channel('payments').info('tx completed')
        const content = fs.readFileSync(path.join(tmpDir, 'payments', 'info.log'), 'utf8')
        expect(content).to.include('tx completed')
    })

    it('channel uses global prefix by default', () => {
        Logger.channel('auth').warn('token expired')
        const content = fs.readFileSync(path.join(tmpDir, 'auth', 'warn.log'), 'utf8')
        expect(content).to.include('(APP)')
    })

    it('channel supports p{level} for custom prefix', () => {
        Logger.channel('auth').pinfo('AUTH', 'login attempt')
        const content = fs.readFileSync(path.join(tmpDir, 'auth', 'info.log'), 'utf8')
        expect(content).to.include('(AUTH)')
    })

    it('channel does not write to main log directory', () => {
        Logger.channel('payments').error('fail')
        expect(fs.existsSync(path.join(tmpDir, 'error.log'))).to.equal(false)
        expect(fs.existsSync(path.join(tmpDir, 'payments', 'error.log'))).to.equal(true)
    })

    it('multiple channels write to separate directories', () => {
        Logger.channel('payments').info('pay')
        Logger.channel('auth').info('login')
        const payContent = fs.readFileSync(path.join(tmpDir, 'payments', 'info.log'), 'utf8')
        const authContent = fs.readFileSync(path.join(tmpDir, 'auth', 'info.log'), 'utf8')
        expect(payContent).to.include('pay')
        expect(authContent).to.include('login')
    })
})

describe('Child logger', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ output: ['console'], colors: false, levels: ALL_LEVELS })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('child logger uses bound prefix', () => {
        const httpLog = Logger.child('HTTP')
        const lines = captureConsoleLog(() => httpLog.info('request received'))
        expect(lines[0]).to.include('(HTTP)')
    })

    it('child logger does not use global prefix', () => {
        Logger.setConfig({ prefix: 'GLOBAL' })
        const httpLog = Logger.child('HTTP')
        const lines = captureConsoleLog(() => httpLog.log('msg'))
        expect(lines[0]).to.include('(HTTP)')
        expect(lines[0]).to.not.include('(GLOBAL)')
    })

    it('child logger supports all levels', () => {
        const log = Logger.child('TEST')
        ALL_LEVELS.forEach((level) => {
            expect(log[level]).to.be.a('function')
        })
    })

    it('child logger can create channel', () => {
        Logger.closeFds()
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-child-ch-'))
        Logger.setConfig({ output: ['file'], logDir: tmpDir })
        const log = Logger.child('PAY')
        log.channel('transactions').info('completed')
        Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'transactions', 'info.log'), 'utf8')
        expect(content).to.include('(PAY)')
        expect(content).to.include('completed')
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })
})
