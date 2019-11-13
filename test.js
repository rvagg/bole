const http = require('http')
const hreq = require('hyperquest')
const test = require('tape')
const bl = require('bl')
const listStream = require('list-stream')
const bole = require('./')
const pid = process.pid
const hostname = require('os').hostname()

function mklogobj (name, level, inp, fastTime) {
  const out = {
    time: fastTime ? Date.now() : new Date().toISOString(),
    hostname: hostname,
    pid: pid,
    level: level,
    name: name
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

test('test simple logging', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
  })
})

test('test complex object logging', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
  })
})

test('test multiple logs', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
  })
})

test('test multiple outputs', (t) => {
  t.plan(4)
  t.on('end', bole.reset)

  const debugSink = bl()
  const infoSink = bl()
  const warnSink = bl()
  const errorSink = bl()
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

  debugSink.end()
  infoSink.end()
  warnSink.end()
  errorSink.end(() => {
    // debug
    t.equal(safe(debugSink.slice().toString()), safe(prepareExpected(expected)))
    // info
    t.equal(safe(infoSink.slice().toString()), safe(prepareExpected(expected.slice(1))))
    // warn
    t.equal(safe(warnSink.slice().toString()), safe(prepareExpected(expected.slice(2))))
    // error
    t.equal(safe(errorSink.slice().toString()), safe(prepareExpected(expected.slice(3))))
  })
})

test('test string formatting', (t) => {
  t.plan(8)
  t.on('end', bole.reset)

  function testSingle (level, msg, args) {
    const sink = bl()
    const log = bole('strfmt')

    bole.output({
      level: level,
      stream: sink
    })

    const expected = mklogobj('strfmt', level, msg)
    log[level].apply(log, args)

    sink.end(() => {
      t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
    })

    bole.reset()
  }

  testSingle('debug', {}, [])
  testSingle('debug', { message: 'test' }, ['test'])
  testSingle('info', { message: 'true' }, [true])
  testSingle('info', { message: 'false' }, [false])
  testSingle('warn', { message: 'a number [42]' }, ['a number [%d]', 42])
  testSingle('error', { message: 'a string [str]' }, ['a string [%s]', 'str'])
  testSingle(
    'error'
    , { message: 'a string [str], a number [101], s, 1, 2 a b c' }
    , ['a string [%s], a number [%d], %s, %s, %s', 'str', 101, 's', 1, 2, 'a', 'b', 'c']
  )
  testSingle('error', { message: 'foo bar baz' }, ['foo', 'bar', 'baz'])
})

test('test error formatting', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    const act = safe(sink.slice().toString()).replace(/("stack":")Error:[^"]+/, '$1STACK')
    t.equal(act, safe(prepareExpected(expected)))
  })
})

test('test error formatting with message', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    const act = safe(sink.slice().toString()).replace(/("stack":")Error:[^"]+/, '$1STACK')
    t.equal(act, safe(prepareExpected(expected)))
  })
})

test('test request object', (t) => {
  t.on('end', bole.reset)

  const sink = bl()
  const log = bole('reqfmt')
  let host

  bole.output({
    level: 'info',
    stream: sink
  })

  const server = http.createServer((req, res) => {
    const expected = mklogobj('reqfmt', 'info', {
      req: {
        method: 'GET',
        url: '/foo?bar=baz',
        headers: {
          host: host,
          connection: 'close'
        },
        remoteAddress: '127.0.0.1',
        remotePort: 'RPORT'
      }
    })
    log.info(req)

    res.end()

    sink.end(() => {
      const act = safe(sink.slice().toString()).replace(/("remotePort":)\d+/, '$1"RPORT"')
      t.equal(act, safe(prepareExpected(expected)))
      server.close(t.end.bind(t))
    })
  })

  server.listen(0, '127.0.0.1', () => {
    host = `${server.address().address}:${server.address().port}`
    hreq.get(`http://${host}/foo?bar=baz`)
  })
})

test('test request object with message', (t) => {
  t.on('end', bole.reset)

  const sink = bl()
  const log = bole('reqfmt')
  let host

  bole.output({
    level: 'info',
    stream: sink
  })

  const server = http.createServer((req, res) => {
    const expected = mklogobj('reqfmt', 'info', {
      message: 'this is a message',
      req: {
        method: 'GET',
        url: '/foo?bar=baz',
        headers: {
          host: host,
          connection: 'close'
        },
        remoteAddress: '127.0.0.1',
        remotePort: 'RPORT'
      }
    })
    log.info(req, 'this is a %s', 'message')

    res.end()

    sink.end(() => {
      const act = safe(sink.slice().toString()).replace(/("remotePort":)\d+/, '$1"RPORT"')
      t.equal(act, safe(prepareExpected(expected)))

      server.close(t.end.bind(t))
    })
  })

  server.listen(0, '127.0.0.1', () => {
    host = `${server.address().address}:${server.address().port}`
    hreq.get(`http://${host}/foo?bar=baz`)
  })
})

test('test sub logger', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
  })
})

test('test object logging', (t) => {
  t.on('end', bole.reset)

  const sink = listStream.obj()
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

  sink.end(() => {
    t.equal(sink.length, expected.length, 'correct number of log entries')
    for (let i = 0; i < expected.length; i++) {
      const actual = sink.get(i)
      actual.time = safeTime(actual.time)
      expected[i].time = safeTime(actual.time)
      t.deepEqual(actual, expected[i], `correct log entry #${i}`)
    }
    t.end()
  })
})

test('test error and object logging', (t) => {
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    let act = safe(sink.slice().toString())

    act = act.replace(/("stack":")Error:[^"]+/, '$1STACK')

    t.equal(act, expected)
    t.end()
  })
})

test('test fast time', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
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

  sink.end(() => {
    t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
  })
})

test('test undefined values', (t) => {
  t.plan(1)
  t.on('end', bole.reset)

  const sink = bl()
  const log = bole('simple')
  const expected = []

  bole.output({
    level: 'debug',
    stream: sink
  })

  expected.push(mklogobj('simple', 'debug', { message: 'testing', aDebug: undefined }))
  log.debug({ aDebug: undefined }, 'testing')

  sink.end(() => {
    t.equal(safe(sink.slice().toString()), safe(prepareExpected(expected)))
  })
})
