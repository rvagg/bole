var stringify  = require('fast-safe-stringify')
  , individual = require('individual')('$$bole', { })
  , format     = require('./format')
  , levels     = 'debug info warn error'.split(' ')
  , hostname   = require('os').hostname()
  , pid        = process.pid
  , hasObjMode = false
  , fastTime   = false


function stackToString (e) {
  var s = e.stack
    , ce

  if (typeof e.cause === 'function' && (ce = e.cause()))
    s += '\nCaused by: ' + stackToString(ce)

  return s
}


function errorToOut (err, out) {
  out.err = {
      name    : err.name
    , message : err.message
    , code    : err.code // perhaps
    , stack   : stackToString(err)
  }
}


function requestToOut (req, out) {
  out.req = {
      method        : req.method
    , url           : req.url
    , headers       : req.headers
    , remoteAddress : req.connection.remoteAddress
    , remotePort    : req.connection.remotePort
  }
}


function objectToOut (obj, out) {
  var k

  for (k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k))
      out[k] = obj[k]
  }
}


function objectMode (stream) {
  return stream._writableState && stream._writableState.objectMode === true
}


function Output (level, name) {
  this.time = fastTime ? Date.now() : new Date().toISOString()
  this.hostname = hostname
  this.pid = pid
  this.level = level
  this.name = name
}


function levelLogger (level, name) {
  return function namedLevelLogger (inp, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16) {
    var outputs = individual[level]

    if (!outputs)
      return // no outputs for this level

    var out = new Output(level, name)
      , i = 0
      , l = outputs.length
      , stringified
      , message

    if (inp == null || typeof inp === 'string') {
      if (message = format(inp, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16))
        out.message = message
    } else {
      if (message = format(a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16))
        out.message = message
      if (typeof inp === 'boolean')
        out.message = String(inp)
      else if (inp instanceof Error) {
        errorToOut(inp, out)
      } else if (typeof inp === 'object') {
        if (inp.method && inp.url && inp.headers && inp.socket)
          requestToOut(inp, out)
        else
          objectToOut(inp, out)
      }
    }

    if (l === 1 && !hasObjMode) { // fast, standard case
      outputs[0].write(new Buffer(stringify(out) + '\n', 'utf8'))
      return
    }

    for (; i < l; i++) {
      if (objectMode(outputs[i])) {
        outputs[i].write(out)
      } else {
        if (stringified === undefined) // lazy stringify
          stringified = new Buffer(stringify(out) + '\n', 'utf8')
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
  if (Array.isArray(opt)) {
    opt.forEach(bole.output)
    return bole
  }

  var i = 0
    , b = false

  for (; i < levels.length; i++) {
    if (levels[i] === opt.level)
      b = true

    if (b) {
      if (!individual[levels[i]])
        individual[levels[i]] = []
      if (opt.stream && objectMode(opt.stream))
        hasObjMode = true
      individual[levels[i]].push(opt.stream)
    }
  }
  return bole
}


bole.reset = function reset () {
  for (var k in individual)
    delete individual[k]
  fastTime = false
  return bole
}


bole.setFastTime = function setFastTime (b) {
  if (!arguments.length)
    fastTime = true
  else
    fastTime = b
  return bole
}


module.exports = bole
