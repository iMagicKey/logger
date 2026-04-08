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
[2026-04-08 07:15:30.123] (MyApp) [INFO] Server started on port 3000
[2026-04-08 07:15:30.124] (MyApp) [ERROR] Unhandled exception Error: oops ...
[2026-04-08 07:15:30.125] (HTTP) [LOG] GET /api/users 200 12ms
```

## API

### `Logger.setConfig(config)`

Configure the logger globally. All fields are optional and merged with the current configuration. Call once at application startup before any logging.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `'APP'` | Default prefix shown in every log line |
| `output` | `string[]` | `['console']` | Output targets — `'console'`, `'file'`, or both |
| `logDir` | `string` | `'./logs'` | Directory for log files; created automatically if absent |
| `colors` | `boolean` | `true` | Enable ANSI colors in console output; only applied when `process.stdout.isTTY` is `true` |
| `levels` | `string[]` | all levels | Restrict which levels produce output; calls to inactive levels are silently ignored |
| `format` | `'text'\|'json'` | `'text'` | Output format; `'json'` outputs JSON lines with ISO 8601 timestamps |
| `maxFileSize` | `number\|null` | `null` | Max file size in bytes before rotation; `null` disables rotation |
| `maxFiles` | `number` | `5` | Max rotated files to keep per level |

---

### `Logger.getConfig()`

Returns a shallow copy of the current configuration object.

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

### Named channels

Create a channel that writes file output to a subdirectory.

```js
const payments = Logger.channel('payments')
payments.info('Transaction completed')
payments.pinfo('STRIPE', 'Webhook received')
// File output goes to {logDir}/payments/info.log
```

---

### Child loggers

Create a logger instance with a bound prefix.

```js
const httpLog = Logger.child('HTTP')
httpLog.info('Request received')    // prefix: HTTP
httpLog.error('Request failed')     // prefix: HTTP

// Child loggers support channels
httpLog.channel('access').log('GET /api/users 200')
```

---

### `Logger.closeFds()`

Closes all open file streams and clears internal caches. Returns a `Promise<void>`. Await before reading log files or on process shutdown.

```js
await Logger.closeFds()
```

### `Logger.flush()`

Flushes all buffered data to disk without closing streams. Returns a `Promise<void>`.

```js
await Logger.flush()
```

---

### Log line format

#### Text (default)

```
[YYYY-MM-DD HH:mm:ss.SSS] (PREFIX) [LEVEL] message
```

#### JSON

```json
{"timestamp":"2026-04-08T12:00:00.000Z","level":"info","prefix":"APP","message":"Server started"}
```

When using channels, a `channel` field is added to the JSON output.

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

Colors are suppressed when `process.stdout.isTTY` is falsy (e.g. piped output, CI environments). JSON format always outputs without colors.

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

File writes are async (buffered via `WriteStream`). The directory is created automatically if it does not exist. File output never includes ANSI color codes.

---

### Log rotation

Enable automatic log rotation by setting `maxFileSize`:

```js
Logger.setConfig({
    output: ['file'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
})
```

When a file exceeds `maxFileSize`, it is renamed (`log.log` → `log.1.log`, `log.1.log` → `log.2.log`, etc.) and a new file is created. Files beyond `maxFiles` are deleted.

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
