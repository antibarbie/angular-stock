const { Transform } = require('stream')

class Filter extends Transform {

  constructor() {
    super({
      readableObjectMode: true,
      writableObjectMode: true
    })
    this.line = 0
  }

  _transform(chunk, encoding, next) {
    this.line++;

    if (this.line > 1) {
      return next(null, chunk)
    }

    next()
  }
}

module.exports = {
    killFirstLine: Filter  
}

