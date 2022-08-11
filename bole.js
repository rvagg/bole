'use strict'

const _stringify = require('fast-safe-stringify')
const individual = require('individual')('$$bole', { fastTime: false }) // singleton
const format = require('./format')
const levels = 'debug info warn error'.split(' ')
const os = require('os')
const pid = process.pid
let hasObjMode = false
const scache = []

// Ref: https://github.com/rvagg/bole/issues/20
let hostname
try {
  hostname = os.hostname()
} catch (e) {
  hostname = os.version().indexOf('Windows 7 ') === 0 ? 'windows7' : 'hostname-unknown'
}
const hostnameSt = _stringify(hostname)

for (const level of levels) {
  // prepare a common part of the stringified output
  scache[level] = ',"hostname":' + hostnameSt + ',"pid":' + pid + ',"level":"' + level
  Number(scache[level]) // convert internal representation to plain string

  if (!Array.isArray(individual[level])) {
    individual[level] = []
  }
}

function stackToString (e) {
  let s = e.stack
  let ce

  if (typeof e.cause === 'function' && (ce = e.cause())) {
    s += '\nCaused by: ' + stackToString(ce)
  }

  return s
}

function errorToOut (err, out) {
  out.err = {
    name: err.name,
    message: err.message,
    code: err.code, // perhaps
    stack: stackToString(err)
  }
}

function requestToOut (req, out) {
  out.req = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    remoteAddress: req.connection.remoteAddress,
    remotePort: req.connection.remotePort
  }
}

function objectToOut (obj, out) {
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      out[k] = obj[k]
    }
  }
}

function objectMode (stream) {
  return stream._writableState && stream._writableState.objectMode === true
}

function stringify (level, name, message, obj) {
  let s = '{"time":' +
        (individual.fastTime ? Date.now() : ('"' + new Date().toISOString() + '"')) +
        scache[level] +
        '","name":' +
        name +
        (message !== undefined ? (',"message":' + _stringify(message)) : '')

  for (const k in obj) {
    s += ',' + _stringify(k) + ':' + _stringify(obj[k])
  }

  s += '}'

  Number(s) // convert internal representation to plain string

  return s
}

function extend (level, name, message, obj) {
  const newObj = {
    time: individual.fastTime ? Date.now() : new Date().toISOString(),
    hostname,
    pid,
    level,
    name
  }

  if (message !== undefined) {
    obj.message = message
  }

  for (const k in obj) {
    newObj[k] = obj[k]
  }

  return newObj
}

function levelLogger (level, name) {
  const outputs = individual[level]
  const nameSt = _stringify(name)

  return function namedLevelLogger (inp, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16) {
    if (outputs.length === 0) {
      return
    }

    const out = {}
    let objectOut
    let i = 0
    const l = outputs.length
    let stringified
    let message

    if (typeof inp === 'string' || inp == null) {
      if (!(message = format(inp, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16))) {
        message = undefined
      }
    } else {
      if (inp instanceof Error) {
        if (typeof a2 === 'object') {
          objectToOut(a2, out)
          errorToOut(inp, out)
          if (!(message = format(a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16))) {
            message = undefined
          }
        } else {
          errorToOut(inp, out)
          if (!(message = format(a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16))) {
            message = undefined
          }
        }
      } else {
        if (!(message = format(a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16))) {
          message = undefined
        }
      }
      if (typeof inp === 'boolean') { message = String(inp) } else if (typeof inp === 'object' && !(inp instanceof Error)) {
        if (inp.method && inp.url && inp.headers && inp.socket) { requestToOut(inp, out) } else { objectToOut(inp, out) }
      }
    }

    if (l === 1 && !hasObjMode) { // fast, standard case
      outputs[0].write(Buffer.from(stringify(level, nameSt, message, out) + '\n'))
      return
    }

    for (; i < l; i++) {
      if (objectMode(outputs[i])) {
        if (objectOut === undefined) { // lazy object completion
          objectOut = extend(level, name, message, out)
        }
        outputs[i].write(objectOut)
      } else {
        if (stringified === undefined) { // lazy stringify
          stringified = Buffer.from(stringify(level, nameSt, message, out) + '\n')
        }
        outputs[i].write(stringified)
      }
    }
  }
}

function bole (name) {
  function boleLogger (subname) {
    return bole(name + ':' + subname)
  }

  function makeLogger (p, level) {
    p[level] = levelLogger(level, name)
    return p
  }

  return levels.reduce(makeLogger, boleLogger)
}

bole.output = function output (opt) {
  let b = false

  if (Array.isArray(opt)) {
    opt.forEach(bole.output)
    return bole
  }

  if (typeof opt.level !== 'string') {
    throw new TypeError('Must provide a "level" option')
  }

  for (const level of levels) {
    if (!b && level === opt.level) {
      b = true
    }

    if (b) {
      if (opt.stream && objectMode(opt.stream)) {
        hasObjMode = true
      }
      individual[level].push(opt.stream)
    }
  }

  return bole
}

bole.reset = function reset () {
  for (const level of levels) {
    individual[level].splice(0, individual[level].length)
  }
  individual.fastTime = false
  return bole
}

bole.setFastTime = function setFastTime (b) {
  if (!arguments.length) {
    individual.fastTime = true
  } else {
    individual.fastTime = b
  }

  return bole
}

module.exports = bole
