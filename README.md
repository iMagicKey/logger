# imagic-logger

> Structured logging with levels, prefixes, ANSI colors, and multi-output support (console + file).

## Install

```bash
npm install imagic-logger
```

## Quick Start

```js
import { Logger } from 'imagic-logger'

Logger.setConfig({
    prefix: 'MyApp',
    output: ['console', 'file'],
    logDir: './logs',
})

Logger.info('Server started on port 3000')
Logger.error('Unhandled exception', new Error('oops'))
Logger.plog('HTTP', 'GET /api/users 200 12ms')
```

Output:
```
[2026-03-22 07:15:30.123] (MyApp) [INFO ] Server started on port 3000
[2026-03-22 07:15:30.124] (MyApp) [ERROR] Unhandled exception Error: oops ...
[2026-03-22 07:15:30.125] (HTTP)  [LOG  ] GET /api/users 200 12ms
```

## API

### `Logger.setConfig(config)`

Configure the logger globally. All fields are optional and merged with the current configuration. Call once at application startup before any logging.

```ts
Logger.setConfig(config: {
    prefix?:  string,
    output?:  Array<'console' | 'file'>,
    logDir?:  string,
    colors?:  boolean,
    levels?:  Array<'log' | 'debug' | 'error' | 'warn' | 'info' | 'crit'>,
}): void
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'APP'` | Default prefix shown in every log line |
| `output` | `string[]` | `['console']` | Output targets — `'console'`, `'file'`, or both |
| `logDir` | `string` | `'./logs'` | Directory for log files; created automatically if absent |
| `colors` | `boolean` | `true` | Enable ANSI colors in console output; only applied when `process.stdout.isTTY` is `true` |
| `levels` | `string[]` | all levels | Restrict which levels produce output; calls to inactive levels are silently ignored |

---

### `Logger.getConfig()`

Returns a shallow copy of the current configuration object.

```ts
Logger.getConfig(): object
```

---

### Log methods

Log a message using the global prefix from `setConfig`.

```ts
Logger.log(...args: any[]): void
Logger.debug(...args: any[]): void
Logger.info(...args: any[]): void
Logger.warn(...args: any[]): void
Logger.error(...args: any[]): void
Logger.crit(...args: any[]): void
```

All arguments are joined into a single log line. Non-string arguments are formatted with `util.inspect(arg, { depth: 4 })`.

---

### Per-call prefix override

Override the global prefix for a single log call. The first argument becomes the prefix; remaining arguments form the message.

```ts
Logger.plog(prefix: string, ...args: any[]): void
Logger.pdebug(prefix: string, ...args: any[]): void
Logger.pinfo(prefix: string, ...args: any[]): void
Logger.pwarn(prefix: string, ...args: any[]): void
Logger.perror(prefix: string, ...args: any[]): void
Logger.pcrit(prefix: string, ...args: any[]): void
```

---

### Log line format

```
[YYYY-MM-DD HH:mm:ss.SSS] (PREFIX) [LEVEL] message
```

Example:
```
[2026-03-22 07:15:30.123] (MyApp) [INFO ] Server started
[2026-03-22 07:15:30.124] (HTTP)  [LOG  ] GET /api/users 200
```

Level labels are padded to 5 characters.

---

### Console colors (TTY only)

| Level | Color |
|-------|-------|
| `log` | white |
| `debug` | cyan |
| `info` | blue |
| `warn` | yellow |
| `error` | red |
| `crit` | bright red + bold |

Colors are suppressed when `process.stdout.isTTY` is falsy (e.g. piped output, CI environments).

---

### File output

When `'file'` is included in `output`, each level writes to its own file inside `logDir`:

```
{logDir}/log.log
{logDir}/debug.log
{logDir}/info.log
{logDir}/warn.log
{logDir}/error.log
{logDir}/crit.log
```

Files are appended synchronously using `fs.appendFileSync`. The directory is created automatically if it does not exist. File output never includes ANSI color codes.

---

### Filtering levels

Pass a `levels` array to restrict which levels produce output. Calls to omitted levels are silently no-ops.

```js
// Disable debug in production
Logger.setConfig({
    levels: ['log', 'error', 'warn', 'info', 'crit'],
})

Logger.debug('This is suppressed')  // no output
Logger.info('This appears')
```

---

## Error Handling

`Logger` does not throw under normal usage. There are no documented error conditions for logging calls themselves. Errors may surface from the file system if `logDir` cannot be created (e.g. permission denied).

---

## Examples

See [`examples/basic.js`](./examples/basic.js) for a runnable demonstration:

```bash
node examples/basic.js
```

---

## License

MIT © iMagicKey
