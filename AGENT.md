# AGENT — imagic-logger

## Purpose

Static logger class providing structured, leveled logging with ANSI color support, configurable output targets (console and/or file), and per-call prefix overrides.

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

### Production config (no debug)

```js
Logger.setConfig({
    prefix: process.env.SERVICE_NAME || 'APP',
    output: ['console'],
    colors: false,
    levels: ['log', 'info', 'warn', 'error', 'crit'],
})
```

### Inspect current config

```js
const cfg = Logger.getConfig()
console.log(cfg.levels)
```

---

## Log Line Format

```
[YYYY-MM-DD HH:mm:ss.SSS] (PREFIX) [LEVEL] message
```

- Timestamp is local time with milliseconds.
- Level label is padded to 5 characters (e.g. `[INFO ]`, `[LOG  ]`).
- File output never contains ANSI codes.

---

## Constraints / Gotchas

- `Logger` is a static class — do not use `new Logger()`.
- `setConfig` merges into the current config; it does not reset fields not mentioned. To change `levels`, pass the full desired array.
- Colors are suppressed automatically when `process.stdout.isTTY` is falsy (piped output, CI, Docker without TTY) even if `colors: true`.
- File output is synchronous (`fs.appendFileSync`); this may add latency on slow disks at high log volume.
- Each level writes to its own file: `log.log`, `debug.log`, `info.log`, `warn.log`, `error.log`, `crit.log`. There is no combined log file.
- If `logDir` cannot be created (permission error), an OS-level error will be thrown at first file write.
- Non-string arguments are inspected with depth 4; deeply nested objects beyond that depth appear as `[Object]`.
- Calling a log method for a level not in `config.levels` is a silent no-op — it will not throw.
- `crit` is the highest severity level; there is no `fatal` or `emergency` alias.
