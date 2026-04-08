import Logger from '../src/index.js'

// Basic console logging
Logger.setConfig({ prefix: 'MyApp', output: ['console'], colors: true })

Logger.log('Application started')
Logger.info('Server listening on port 3000')
Logger.debug('Config loaded:', { env: 'development' })
Logger.warn('Deprecated API endpoint called')
Logger.error('Failed to connect to database')
Logger.crit('Out of memory')

// Per-call prefix
Logger.plog('HTTP', 'GET /api/users 200 12ms')
Logger.perror('DB', 'Query timeout after 5000ms')

// Named channels (file output goes to {logDir}/{channel}/)
const payments = Logger.channel('payments')
payments.info('Transaction completed')

// Child logger with bound prefix
const httpLog = Logger.child('HTTP')
httpLog.info('Request received')
httpLog.error('Connection refused')

// JSON output format
Logger.setConfig({ format: 'json' })
Logger.info('JSON format example')
// {"timestamp":"...","level":"info","prefix":"MyApp","message":"JSON format example"}

// Log rotation config example
// Logger.setConfig({
//     output: ['file'],
//     logDir: './logs',
//     maxFileSize: 10 * 1024 * 1024, // 10MB per file
//     maxFiles: 5,                    // keep 5 rotated files
// })

// Graceful shutdown
// await Logger.closeFds()
