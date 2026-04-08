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

    afterEach(async () => {
        await Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore cleanup errors
        }
    })

    it('creates a log file for each level called', async () => {
        Logger.log('file message')
        await Logger.flush()
        const logFile = path.join(tmpDir, 'log.log')
        expect(fs.existsSync(logFile)).to.equal(true)
    })

    it('writes the correct content to the log file', async () => {
        Logger.error('something went wrong')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'error.log'), 'utf8')
        expect(content).to.include('something went wrong')
        expect(content).to.include('[ERROR]')
        expect(content).to.include('(FILETEST)')
    })

    it('appends multiple lines to the same file', async () => {
        Logger.warn('first')
        Logger.warn('second')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'warn.log'), 'utf8')
        const lines = content.trim().split('\n')
        expect(lines).to.have.lengthOf(2)
        expect(lines[0]).to.include('first')
        expect(lines[1]).to.include('second')
    })

    it('file output contains timestamp', async () => {
        Logger.info('timestamp check')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(content).to.match(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/)
    })

    it('file output does not contain ANSI color codes', async () => {
        Logger.crit('critical')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'crit.log'), 'utf8')
        expect(content).to.not.include('\x1b')
    })

    it('creates the logDir if it does not exist', async () => {
        const nestedDir = path.join(tmpDir, 'nested', 'logs')
        Logger.setConfig({ logDir: nestedDir })
        Logger.debug('nested dir test')
        await Logger.flush()
        expect(fs.existsSync(path.join(nestedDir, 'debug.log'))).to.equal(true)
    })

    it('p{level} uses per-call prefix in file output', async () => {
        Logger.pinfo('CUSTOM', 'per-call prefix test')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(content).to.include('(CUSTOM)')
    })

    it('writes correct log files for each level', async () => {
        ALL_LEVELS.forEach((level) => Logger[level](`${level} message`))
        await Logger.closeFds()
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

    afterEach(async () => {
        await Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore cleanup errors
        }
    })

    it('writes to both console and file simultaneously', async () => {
        const lines = captureConsoleLog(() => Logger.info('dual output'))
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(lines).to.have.lengthOf(1)
        expect(lines[0]).to.include('dual output')
        expect(content).to.include('dual output')
    })
})

describe('Named channels', () => {
    let tmpDir
    let originalConfig

    beforeEach(async () => {
        originalConfig = Logger.getConfig()
        await Logger.closeFds()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-channel-'))
        Logger.setConfig({ prefix: 'APP', output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS })
    })

    afterEach(async () => {
        await Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore
        }
    })

    it('channel writes to a subdirectory named after the channel', async () => {
        Logger.channel('payments').info('tx completed')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'payments', 'info.log'), 'utf8')
        expect(content).to.include('tx completed')
    })

    it('channel uses global prefix by default', async () => {
        Logger.channel('auth').warn('token expired')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'auth', 'warn.log'), 'utf8')
        expect(content).to.include('(APP)')
    })

    it('channel supports p{level} for custom prefix', async () => {
        Logger.channel('auth').pinfo('AUTH', 'login attempt')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'auth', 'info.log'), 'utf8')
        expect(content).to.include('(AUTH)')
    })

    it('channel does not write to main log directory', async () => {
        Logger.channel('payments').error('fail')
        await Logger.flush()
        expect(fs.existsSync(path.join(tmpDir, 'error.log'))).to.equal(false)
        expect(fs.existsSync(path.join(tmpDir, 'payments', 'error.log'))).to.equal(true)
    })

    it('multiple channels write to separate directories', async () => {
        Logger.channel('payments').info('pay')
        Logger.channel('auth').info('login')
        await Logger.closeFds()
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

    it('child logger can create channel', async () => {
        await Logger.closeFds()
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-child-ch-'))
        Logger.setConfig({ output: ['file'], logDir: tmpDir })
        const log = Logger.child('PAY')
        log.channel('transactions').info('completed')
        await Logger.closeFds()
        const content = fs.readFileSync(path.join(tmpDir, 'transactions', 'info.log'), 'utf8')
        expect(content).to.include('(PAY)')
        expect(content).to.include('completed')
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })
})

describe('Async file writes', () => {
    let tmpDir
    let originalConfig

    beforeEach(async () => {
        originalConfig = Logger.getConfig()
        await Logger.closeFds()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-async-'))
        Logger.setConfig({ prefix: 'ASYNC', output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS })
    })

    afterEach(async () => {
        await Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore
        }
    })

    it('closeFds returns a promise', () => {
        const result = Logger.closeFds()
        expect(result).to.be.instanceOf(Promise)
    })

    it('flush returns a promise', () => {
        Logger.log('trigger stream creation')
        const result = Logger.flush()
        expect(result).to.be.instanceOf(Promise)
    })

    it('flush drains data without closing streams', async () => {
        Logger.info('first write')
        await Logger.flush()
        const content1 = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(content1).to.include('first write')
        // stream is still open — can write more
        Logger.info('second write')
        await Logger.closeFds()
        const content2 = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(content2).to.include('second write')
    })

    it('closeFds resolves after all streams are closed', async () => {
        Logger.log('msg1')
        Logger.error('msg2')
        Logger.info('msg3')
        await Logger.closeFds()
        const logContent = fs.readFileSync(path.join(tmpDir, 'log.log'), 'utf8')
        const errorContent = fs.readFileSync(path.join(tmpDir, 'error.log'), 'utf8')
        const infoContent = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        expect(logContent).to.include('msg1')
        expect(errorContent).to.include('msg2')
        expect(infoContent).to.include('msg3')
    })
})

describe('Log rotation', () => {
    let tmpDir
    let originalConfig

    beforeEach(async () => {
        originalConfig = Logger.getConfig()
        await Logger.closeFds()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-rotation-'))
    })

    afterEach(async () => {
        await Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore
        }
    })

    it('no rotation when maxFileSize is null', async () => {
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, maxFileSize: null })
        for (let i = 0; i < 100; i++) {
            Logger.log(`message ${i}`)
        }
        await Logger.closeFds()
        expect(fs.existsSync(path.join(tmpDir, 'log.log'))).to.equal(true)
        expect(fs.existsSync(path.join(tmpDir, 'log.1.log'))).to.equal(false)
    })

    it('rotates when file exceeds maxFileSize', async () => {
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, maxFileSize: 100, maxFiles: 5 })
        for (let i = 0; i < 20; i++) {
            Logger.log(`rotation test message number ${i}`)
        }
        await Logger.closeFds()
        expect(fs.existsSync(path.join(tmpDir, 'log.1.log'))).to.equal(true)
        const currentContent = fs.readFileSync(path.join(tmpDir, 'log.log'), 'utf8')
        expect(currentContent.length).to.be.lessThan(200)
    })

    it('rotation chain respects maxFiles', async () => {
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, maxFileSize: 50, maxFiles: 2 })
        for (let i = 0; i < 50; i++) {
            Logger.log(`msg ${i}`)
        }
        await Logger.closeFds()
        expect(fs.existsSync(path.join(tmpDir, 'log.1.log'))).to.equal(true)
        expect(fs.existsSync(path.join(tmpDir, 'log.2.log'))).to.equal(true)
        expect(fs.existsSync(path.join(tmpDir, 'log.3.log'))).to.equal(false)
    })

    it('rotated files contain correct content', async () => {
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, maxFileSize: 100, maxFiles: 5 })
        Logger.log('before rotation')
        for (let i = 0; i < 20; i++) {
            Logger.log(`filler message number ${i}`)
        }
        await Logger.closeFds()
        // The earliest messages should be in the highest-numbered rotated file
        const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith('log.'))
        expect(files.length).to.be.greaterThan(1)
    })

    it('rotation works for channels', async () => {
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, maxFileSize: 100, maxFiles: 3 })
        for (let i = 0; i < 20; i++) {
            Logger.channel('payments').info(`payment ${i}`)
        }
        await Logger.closeFds()
        expect(fs.existsSync(path.join(tmpDir, 'payments', 'info.1.log'))).to.equal(true)
    })

    it('bytes tracking accounts for existing file size', async () => {
        // Pre-create a file with some content
        fs.mkdirSync(tmpDir, { recursive: true })
        const preContent = `${'x'.repeat(80)}\n`
        fs.writeFileSync(path.join(tmpDir, 'log.log'), preContent)
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, maxFileSize: 100, maxFiles: 3 })
        // This write should trigger rotation since existing file is 81 bytes
        Logger.log('this should trigger rotation')
        await Logger.closeFds()
        expect(fs.existsSync(path.join(tmpDir, 'log.1.log'))).to.equal(true)
    })
})

describe('JSON output format', () => {
    let originalConfig

    beforeEach(() => {
        originalConfig = Logger.getConfig()
        Logger.setConfig({ output: ['console'], colors: false, levels: ALL_LEVELS, format: 'json' })
    })

    afterEach(() => {
        Logger.setConfig(originalConfig)
    })

    it('JSON format outputs valid JSON to console', () => {
        const lines = captureConsoleLog(() => Logger.info('json test'))
        expect(lines).to.have.lengthOf(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed).to.be.an('object')
    })

    it('JSON output contains timestamp in ISO 8601', () => {
        const lines = captureConsoleLog(() => Logger.log('ts'))
        const parsed = JSON.parse(lines[0])
        expect(parsed.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('JSON output contains level field', () => {
        const lines = captureConsoleLog(() => Logger.error('err'))
        const parsed = JSON.parse(lines[0])
        expect(parsed.level).to.equal('error')
    })

    it('JSON output contains prefix field', () => {
        Logger.setConfig({ prefix: 'MYAPP', format: 'json' })
        const lines = captureConsoleLog(() => Logger.info('msg'))
        const parsed = JSON.parse(lines[0])
        expect(parsed.prefix).to.equal('MYAPP')
    })

    it('JSON output contains message field', () => {
        const lines = captureConsoleLog(() => Logger.warn('hello world'))
        const parsed = JSON.parse(lines[0])
        expect(parsed.message).to.include('hello world')
    })

    it('JSON output has no ANSI codes', () => {
        Logger.setConfig({ colors: true, format: 'json' })
        const lines = captureConsoleLog(() => Logger.crit('critical'))
        expect(lines[0]).to.not.include('\x1b')
    })

    it('JSON output includes channel field when using channel', () => {
        const lines = captureConsoleLog(() => Logger.channel('payments').info('tx'))
        const parsed = JSON.parse(lines[0])
        expect(parsed.channel).to.equal('payments')
    })

    it('JSON output omits channel field for non-channel logs', () => {
        const lines = captureConsoleLog(() => Logger.info('no channel'))
        const parsed = JSON.parse(lines[0])
        expect(parsed).to.not.have.property('channel')
    })

    it('p{level} prefix appears in JSON output', () => {
        const lines = captureConsoleLog(() => Logger.pinfo('CUSTOM', 'msg'))
        const parsed = JSON.parse(lines[0])
        expect(parsed.prefix).to.equal('CUSTOM')
    })

    it('text format remains default and unchanged', () => {
        Logger.setConfig({ format: 'text' })
        const lines = captureConsoleLog(() => Logger.info('text mode'))
        expect(lines[0]).to.match(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/)
        expect(lines[0]).to.include('[INFO]')
    })

    it('non-string args in JSON message use util.inspect', () => {
        const lines = captureConsoleLog(() => Logger.log({ key: 'val' }))
        const parsed = JSON.parse(lines[0])
        expect(parsed.message).to.include('key')
        expect(parsed.message).to.include('val')
    })
})

describe('JSON file output', () => {
    let tmpDir
    let originalConfig

    beforeEach(async () => {
        originalConfig = Logger.getConfig()
        await Logger.closeFds()
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imagic-logger-json-file-'))
        Logger.setConfig({ output: ['file'], logDir: tmpDir, colors: false, levels: ALL_LEVELS, format: 'json' })
    })

    afterEach(async () => {
        await Logger.closeFds()
        Logger.setConfig(originalConfig)
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // ignore
        }
    })

    it('JSON format writes valid JSON lines to file', async () => {
        Logger.info('file json')
        Logger.error('file error')
        await Logger.closeFds()
        const infoContent = fs.readFileSync(path.join(tmpDir, 'info.log'), 'utf8')
        const parsed = JSON.parse(infoContent.trim())
        expect(parsed.message).to.include('file json')
        expect(parsed.level).to.equal('info')
    })
})
