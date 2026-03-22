import Logger from '../src/index.js'

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
