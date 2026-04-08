# AGENT — imagic-logger

## Purpose

Static logger class providing structured, leveled logging with ANSI color support, configurable output targets (console and/or file), per-call prefix overrides, named channels, child loggers, log rotation, and JSON output format.

## Package

- npm: `imagic-logger`
- import (local): `import { Logger } from '../src/index.js'`
- import (installed): `import { Logger } from 'imagic-logger'`
- default export also available: `import Logger from 'imagic-logger'`
- zero runtime deps

## Exports

### `Logger` (class, used as a static singleton)

All methods are static. Do not instantiate `Logger`.

---

### `Logger.setConfig(config)`: `void`
- `config` {object} — partial config object; fields are merged with current config
  - `prefix` {string} ['APP'] — default prefix for all log lines
  - `output` {Array<'console'|'file'>} [['console']] — output targets
  - `logDir` {string} ['./logs'] — directory for log files; auto-created
  - `colors` {boolean} [true] — ANSI colors; only applied when `process.stdout.isTTY`
  - `levels` {Array<string>} [all] — active log levels; calls to inactive levels are silent no-ops
  - `format` {'text'|'json'} ['text'] — output format; `'json'` outputs JSON lines with ISO 8601 timestamps
  - `maxFileSize` {number|null} [null] — max file size in bytes before rotation; `null` disables rotation
  - `maxFiles` {number} [5] — max rotated files to keep per level
- returns: `void`
- Call once at app startup before any logging.

---

### `Logger.getConfig()`: `object`
- returns: shallow copy of the current config object

---

### `Logger.log(...args)`: `void`
### `Logger.debug(...args)`: `void`
### `Logger.info(...args)`: `void`
### `Logger.warn(...args)`: `void`
### `Logger.error(...args)`: `void`
### `Logger.crit(...args)`: `void`
- `args` {any[]} — values to log; non-strings formatted with `util.inspect(arg, { depth: 4 })`
- Uses the global prefix from `setConfig`
- Silent no-op if the level is not in `config.levels`

---

### `Logger.plog(prefix, ...args)`: `void`
### `Logger.pdebug(prefix, ...args)`: `void`
### `Logger.pinfo(prefix, ...args)`: `void`
### `Logger.pwarn(prefix, ...args)`: `void`
### `Logger.perror(prefix, ...args)`: `void`
### `Logger.pcrit(prefix, ...args)`: `void`
- `prefix` {string} — overrides the global prefix for this single call
- `args` {any[]} — values to log
- Silent no-op if the level is not in `config.levels`

---

### `Logger.channel(channelName)`: `object`
- `channelName` {string} — channel name; file output writes to `{logDir}/{channelName}/`
- returns: object with all level methods (`log`, `info`, etc.) and `p{level}` methods
- Channel logs go to a subdirectory, not the main logDir

---

### `Logger.child(prefix)`: `object`
- `prefix` {string} — bound prefix for all log calls
- returns: object with all level methods and a `.channel(name)` method
- Inherits global config (levels, output, etc.)

---

### `Logger.closeFds()`: `Promise<void>`
- Closes all open file streams and clears internal caches
- Returns a Promise; await before reading files or on shutdown
- Safe to call multiple times

### `Logger.flush()`: `Promise<void>`
- Flushes all buffered data to disk without closing streams
- Returns a Promise; await when you need to ensure data is written

---

## Usage Patterns

### Basic setup

```js
import { Logger } from '../src/index.js'

Logger.setConfig({
    prefix: 'API',
    output: ['console', 'file'],
    logDir: './logs',
    levels: ['log', 'info', 'warn', 'error', 'crit'],
})

Logger.info('App started')
Logger.warn('Low memory', { free: '128MB' })
Logger.error('Request failed', new Error('timeout'))
```

### Per-call prefix (component tagging)

```js
Logger.pinfo('DB', 'Connected to PostgreSQL')
Logger.perror('HTTP', 'POST /login 401')
Logger.pdebug('CACHE', 'Miss for key', 'user:42')
```

### Named channels

```js
Logger.channel('payments').info('Transaction completed')
Logger.channel('auth').pinfo('AUTH', 'Login attempt')
```

### Child logger

```js
const httpLog = Logger.child('HTTP')
httpLog.info('Request received')
httpLog.channel('access').log('GET /api/users 200')
```

### JSON output

```js
Logger.setConfig({ format: 'json' })
Logger.info('Server started')
// {"timestamp":"2026-04-08T12:00:00.000Z","level":"info","prefix":"APP","message":"Server started"}
```

### Log rotation

```js
Logger.setConfig({
    output: ['file'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
})
```

### Graceful shutdown

```js
process.on('beforeExit', async () => {
    await Logger.closeFds()
})
```

### Production config (no debug)

```js
Logger.setConfig({
    prefix: process.env.SERVICE_NAME || 'APP',
    output: ['console'],
    colors: false,
    levels: ['log', 'info', 'warn', 'error', 'crit'],
})
```

---

## Log Line Format

### Text format (default)

```
[YYYY-MM-DD HH:mm:ss.SSS] (PREFIX) [LEVEL] message
```

- Timestamp is local time with milliseconds.
- File output never contains ANSI codes.

### JSON format

```json
{"timestamp":"2026-04-08T12:00:00.000Z","level":"info","prefix":"APP","message":"..."}
```

- Timestamp is ISO 8601 UTC.
- `channel` field added only for channel logs.
- No ANSI codes in JSON mode.

---

## Constraints / Gotchas

- `Logger` is a static class — do not use `new Logger()`.
- `setConfig` merges into the current config; it does not reset fields not mentioned. To change `levels`, pass the full desired array.
- Colors are suppressed automatically when `process.stdout.isTTY` is falsy (piped output, CI, Docker without TTY) even if `colors: true`.
- File writes are async (buffered via `WriteStream`). Call `await Logger.closeFds()` or `await Logger.flush()` before reading log files or exiting.
- Each level writes to its own file: `log.log`, `debug.log`, etc. There is no combined log file.
- If `logDir` cannot be created (permission error), an OS-level error will be thrown at first file write.
- Non-string arguments are inspected with depth 4; deeply nested objects beyond that depth appear as `[Object]`.
- Calling a log method for a level not in `config.levels` is a silent no-op — it will not throw.
- `crit` is the highest severity level; there is no `fatal` or `emergency` alias.
- Rotation renames files synchronously (`level.log` → `level.1.log`, etc.). Oldest files beyond `maxFiles` are deleted.
- JSON format disables ANSI colors regardless of `colors` setting.

---

## Knowledge Base

**KB tags for this library:** `imagic-logger, logging`

Before COMPLEX tasks — invoke `knowledge-reader` with tags above + task-specific tags.
After completing a task — if a reusable pattern, error, or decision emerged, invoke `knowledge-writer` with `source: imagic-logger`.

See `CLAUDE.md` §Knowledge Base Protocol for the full workflow.
