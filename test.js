import test from 'node:test'
import assert from 'node:assert'
import * as http from 'node:http'
import { Writable } from 'node:stream'
import * as os from 'node:os'
import bole from './bole.js'

const pid = process.pid
const hostname = os.hostname()

function bufferSink () {
  const chunks = []
  const stream = new Writable({
    write (chunk, enc, cb) {
      chunks.push(chunk)
      cb()
    }
  })
  Object.defineProperty(stream, 'text', {
    get () { return Buffer.concat(chunks).toString() }
  })
  return stream
}

function objectSink () {
  const items = []
  const stream = new Writable({
    objectMode: true,
    write (chunk, enc, cb) {
      items.push(chunk)
      cb()
    }
  })
  Object.defineProperty(stream, 'items', { get () { return items } })
  return stream
}

function endSink (sink) {
  return new Promise((resolve) => sink.end(resolve))
}

function mklogobj (name, level, inp, fastTime) {
  const out = {
    time: fastTime ? Date.now() : new Date().toISOString(),
    hostname,
    pid,
    level,
    name
  }

  for (const k in inp) {
    if (Object.prototype.hasOwnProperty.call(inp, k)) { out[k] = inp[k] }
  }

  return out
}

// take a log string and zero out the millisecond field
// to make comparison a little safer (not *entirely* safe)
function safe (str) {
  return str.replace(/("time":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.)\d{3}Z"/g, '$1xxxZ')
    .replace(/("remoteAddress":")(?:::ffff:)?(127.0.0.1")/g, '$1$2')
    .replace(/("host":")(?:(?:localhost)|(?:::))(:\d+")/g, '$1$2')
}

// just the time value part of the above
function safeTime (time) {
  return time.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.)\d{3}Z$/, '$1xxxZ')
}

function prepareExpected (expected) {
  return (Array.isArray(expected) ? expected : [expected]).reduce((p, c) => {
    return `${p}${JSON.stringify(c)}\n`
  }, '')
}

test('test simple logging', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('simple')
  const expected = []

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('simple', 'debug', { aDebug: 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple', 'info', { anInfo: 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('simple', 'warn', { aWarn: 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple', 'error', { anError: 'object' }))
  log.error({ anError: 'object' })

  await endSink(sink)
  assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))
})

test('test complex object logging', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('simple')
  const expected = []
  const cplx = {
    aDebug: 'object',
    deep: { deeper: { deeperStill: { tooDeep: 'whoa' }, arr: [1, 2, 3, { eh: 'wut?' }] } }
  }

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('simple', 'debug', cplx))
  log.debug(cplx)

  await endSink(sink)
  assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))
})

test('test multiple logs', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log1 = bole('simple1')
  const log2 = bole('simple2')
  const expected = []

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('simple1', 'debug', { aDebug: 'object' }))
  log1.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple1', 'info', { anInfo: 'object' }))
  log1.info({ anInfo: 'object' })
  expected.push(mklogobj('simple2', 'warn', { aWarn: 'object' }))
  log2.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple2', 'error', { anError: 'object' }))
  log2.error({ anError: 'object' })

  await endSink(sink)
  assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))
})

test('test multiple outputs', async (t) => {
  t.after(() => bole.reset())

  const debugSink = bufferSink()
  const infoSink = bufferSink()
  const warnSink = bufferSink()
  const errorSink = bufferSink()
  const log = bole('simple')
  const expected = []

  // add individual
  bole.output({
    level: 'debug',
    stream: debugSink
  })

  // add array
  bole.output([
    {
      level: 'info',
      stream: infoSink
    },
    {
      level: 'warn',
      stream: warnSink
    }
  ])

  bole.output({
    level: 'error',
    stream: errorSink
  })

  expected.push(mklogobj('simple', 'debug', { aDebug: 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple', 'info', { anInfo: 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('simple', 'warn', { aWarn: 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple', 'error', { anError: 'object' }))
  log.error({ anError: 'object' })

  await Promise.all([
    endSink(debugSink),
    endSink(infoSink),
    endSink(warnSink),
    endSink(errorSink)
  ])

  assert.strictEqual(safe(debugSink.text), safe(prepareExpected(expected)))
  assert.strictEqual(safe(infoSink.text), safe(prepareExpected(expected.slice(1))))
  assert.strictEqual(safe(warnSink.text), safe(prepareExpected(expected.slice(2))))
  assert.strictEqual(safe(errorSink.text), safe(prepareExpected(expected.slice(3))))
})

test('test string formatting', async (t) => {
  t.after(() => bole.reset())

  async function testSingle (level, msg, args) {
    const sink = bufferSink()
    const log = bole('strfmt')

    bole.output({
      level,
      stream: sink
    })

    const expected = mklogobj('strfmt', level, msg)
    log[level](...args)

    await endSink(sink)
    assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))

    bole.reset()
  }

  await testSingle('debug', {}, [])
  await testSingle('debug', { message: 'test' }, ['test'])
  await testSingle('info', { message: 'true' }, [true])
  await testSingle('info', { message: 'false' }, [false])
  await testSingle('warn', { message: 'a number [42]' }, ['a number [%d]', 42])
  await testSingle('error', { message: 'a string [str]' }, ['a string [%s]', 'str'])
  await testSingle(
    'error',
    { message: 'a string [str], a number [101], s, 1, 2 a b c' },
    ['a string [%s], a number [%d], %s, %s, %s', 'str', 101, 's', 1, 2, 'a', 'b', 'c']
  )
  await testSingle('error', { message: 'foo bar baz' }, ['foo', 'bar', 'baz'])
})

test('test error formatting', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('errfmt')
  const err = new Error('error msg in here')

  bole.output({
    level: 'debug',
    stream: sink
  })

  const expected = mklogobj('errfmt', 'debug', {
    err: {
      name: 'Error',
      message: 'error msg in here',
      stack: 'STACK'
    }
  })
  log.debug(err)

  await endSink(sink)
  const act = safe(sink.text).replace(/("stack":")Error:[^"]+/, '$1STACK')
  assert.strictEqual(act, safe(prepareExpected(expected)))
})

test('test error formatting with message', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('errfmt')
  const err = new Error('error msg in here')

  bole.output({
    level: 'debug',
    stream: sink
  })

  const expected = mklogobj('errfmt', 'debug', {
    message: 'this is a message',
    err: {
      name: 'Error',
      message: 'error msg in here',
      stack: 'STACK'
    }
  })
  log.debug(err, 'this is a %s', 'message')

  await endSink(sink)
  const act = safe(sink.text).replace(/("stack":")Error:[^"]+/, '$1STACK')
  assert.strictEqual(act, safe(prepareExpected(expected)))
})

test('test request object', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('reqfmt')

  bole.output({
    level: 'info',
    stream: sink
  })

  await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const host = `${server.address().address}:${server.address().port}`
      const expected = mklogobj('reqfmt', 'info', {
        req: {
          method: 'GET',
          url: '/foo?bar=baz',
          headers: {
            host,
            connection: 'close'
          },
          remoteAddress: '127.0.0.1',
          remotePort: 'RPORT'
        }
      })
      log.info(req)

      res.end()

      sink.end(() => {
        const act = safe(sink.text).replace(/("remotePort":)\d+/, '$1"RPORT"')
        try {
          assert.strictEqual(act, safe(prepareExpected(expected)))
          server.close(resolve)
        } catch (err) {
          server.close(() => reject(err))
        }
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const host = `${server.address().address}:${server.address().port}`
      http.get(`http://${host}/foo?bar=baz`, { agent: false }).on('error', reject)
    })
  })
})

test('test request object with message', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('reqfmt')

  bole.output({
    level: 'info',
    stream: sink
  })

  await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const host = `${server.address().address}:${server.address().port}`
      const expected = mklogobj('reqfmt', 'info', {
        message: 'this is a message',
        req: {
          method: 'GET',
          url: '/foo?bar=baz',
          headers: {
            host,
            connection: 'close'
          },
          remoteAddress: '127.0.0.1',
          remotePort: 'RPORT'
        }
      })
      log.info(req, 'this is a %s', 'message')

      res.end()

      sink.end(() => {
        const act = safe(sink.text).replace(/("remotePort":)\d+/, '$1"RPORT"')
        try {
          assert.strictEqual(act, safe(prepareExpected(expected)))
          server.close(resolve)
        } catch (err) {
          server.close(() => reject(err))
        }
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const host = `${server.address().address}:${server.address().port}`
      http.get(`http://${host}/foo?bar=baz`, { agent: false }).on('error', reject)
    })
  })
})

test('test sub logger', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('parent')
  const expected = []
  let sub1
  let sub2

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('parent', 'debug', { aDebug: 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('parent', 'info', { anInfo: 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('parent', 'warn', { aWarn: 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('parent', 'error', { anError: 'object' }))
  log.error({ anError: 'object' })

  expected.push(mklogobj('parent:sub1', 'debug', { aDebug: 'object' }))
  ;(sub1 = log('sub1')).debug({ aDebug: 'object' })
  expected.push(mklogobj('parent:sub1', 'info', { anInfo: 'object' }))
  sub1.info({ anInfo: 'object' })
  expected.push(mklogobj('parent:sub2', 'warn', { aWarn: 'object' }))
  ;(sub2 = log('sub2')).warn({ aWarn: 'object' })
  expected.push(mklogobj('parent:sub2:subsub', 'error', { anError: 'object' }))
  sub2('subsub').error({ anError: 'object' })

  await endSink(sink)
  assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))
})

test('test object logging', async (t) => {
  t.after(() => bole.reset())

  const sink = objectSink()
  const log = bole('simple')
  const expected = []

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('simple', 'debug', { aDebug: 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple', 'info', { anInfo: 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('simple', 'warn', { aWarn: 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple', 'error', { anError: 'object' }))
  log.error({ anError: 'object' })

  await endSink(sink)
  assert.strictEqual(sink.items.length, expected.length, 'correct number of log entries')
  for (let i = 0; i < expected.length; i++) {
    const actual = sink.items[i]
    actual.time = safeTime(actual.time)
    expected[i].time = safeTime(actual.time)
    assert.deepStrictEqual(actual, expected[i], `correct log entry #${i}`)
  }
})

test('test error and object logging', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('errobjfmt')
  const err = new Error('anError')

  bole.output({
    level: 'debug',
    stream: sink
  })

  log.debug(err, { aDebug: 'object' })

  const expected = safe(prepareExpected(mklogobj('errobjfmt', 'debug', {
    aDebug: 'object',
    err: {
      name: 'Error',
      message: 'anError',
      stack: 'STACK'
    }
  })))

  await endSink(sink)
  let act = safe(sink.text)
  act = act.replace(/("stack":")Error:[^"]+/, '$1STACK')
  assert.strictEqual(act, expected)
})

test('test fast time', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('simple')
  const expected = []

  bole.output({
    level: 'debug',
    stream: sink
  })

  bole.setFastTime(true)

  expected.push(mklogobj('simple', 'debug', { aDebug: 'object' }, true))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple', 'info', { anInfo: 'object' }, true))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('simple', 'warn', { aWarn: 'object' }, true))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple', 'error', { anError: 'object' }, true))
  log.error({ anError: 'object' })

  await endSink(sink)
  assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))
})

test('test undefined values', async (t) => {
  t.after(() => bole.reset())

  const sink = bufferSink()
  const log = bole('simple')
  const expected = []

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('simple', 'debug', { message: 'testing', aDebug: undefined }))
  log.debug({ aDebug: undefined }, 'testing')

  await endSink(sink)
  assert.strictEqual(safe(sink.text), safe(prepareExpected(expected)))
})
