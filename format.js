// consider this a warning about getting obsessive about optimization

var utilformat = require('util').format


function format (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16) {
  if (a16 === undefined) {
    if (a15 === undefined) {
      if (a14 === undefined) {
        if (a13 === undefined) {
          if (a12 === undefined) {
            if (a11 === undefined) {
              if (a10 === undefined) {
                if (a9 === undefined) {
                  if (a8 === undefined) {
                    if (a7 === undefined) {
                      if (a6 === undefined) {
                        if (a5 === undefined) {
                          if (a4 === undefined) {
                            if (a3 === undefined) {
                              if (a2 === undefined) {
                                if (a1 === undefined)
                                  return undefined
                                return utilformat(a1)
                              }
                              return utilformat(a1, a2)
                            }
                            return utilformat(a1, a2, a3)
                          }
                          return utilformat(a1, a2, a3, a4)
                        }
                        return utilformat(a1, a2, a3, a4, a5)
                      }
                      return utilformat(a1, a2, a3, a4, a5, a6)
                    }
                    return utilformat(a1, a2, a3, a4, a5, a6, a7)
                  }
                  return utilformat(a1, a2, a3, a4, a5, a6, a7, a8)
                }
                return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9)
              }
              return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10)
            }
            return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11)
          }
          return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12)
        }
        return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13)
      }
      return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14)
    }
    return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15)
  }
  return utilformat(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16)
}


module.exports = format