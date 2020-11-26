import chalk from 'chalk'

export const reporter = {
  info: (msg?: string) => console.log(`${chalk.black.bgBlue(' INFO ')} ${msg}`),
  warn: (msg?: string) =>
    console.log(`${chalk.black.bgYellow(' WARN ')} ${msg}`),
  fail: (msg?: string) => console.log(`${chalk.black.bgRed(' FAIL ')} ${msg}`),
  done: (msg?: string) =>
    console.log(`${chalk.black.bgGreen(' DONE ')} ${msg}`),
}
