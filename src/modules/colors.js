export const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    brightRed: '\x1b[91m',
    white: '\x1b[37m',
}

export const LEVEL_COLORS = {
    log: COLORS.white,
    debug: COLORS.cyan,
    info: COLORS.blue,
    warn: COLORS.yellow,
    error: COLORS.red,
    crit: COLORS.brightRed + COLORS.bold,
}
