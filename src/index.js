
let EFFECT = Symbol('EFFECT')
let CHANNEL = Symbol('CHANNEL')
let TASK = Symbol('TASK')
let CLOSED = Symbol('CLOSED')

class Cancellation {}


class Buffer {
  constructor(options = {}){
    this.open = true 
    this.options = options
    this.queue = []
    this.takers = []
    this.buffer = []
    this.maxLength = this.options.length || 0
    this.type = this.options.type || 'fixed' // sliding, dropping, fixed   
  }  
  put(val, fn) {
    if(this.takers.length > 0){
      let taker = this.takers.shift()
      taker(val)
      fn(this.open)
      return 
    }

    if(this.buffer.length === this.maxLength){      
      this.queue.push({val, fn})  
      return 
    }
    this.buffer.push({ val })
    fn()    
  }
  take(fn) {
    let datum = this.buffer.length > 0 ? this.buffer.shift() : 
      this.queue.length > 0 ? this.queue.shift() : 
      null
    if(this.buffer.length < this.maxLength && this.queue.length > 0){
      let { val, fn } = this.queue.shift()
      this.buffer.push({ val })
      fn(this.open)
    }
    if(datum) {
      fn(datum.val)
      if(datum.fn) datum.fn(this.open)

    }
    else {
      if(this.open){
        this.takers.push(fn)  
      }
      else {
        fn(CLOSED)
      }      
    }    
  }
  close(){
    this.open = false 
    if(this.takers.length > 0){
      this.takers.forEach(fn => fn(CLOSED))
      this.takers = []
    }
    if(this.queue.length > 0){
      this.queue.forEach(x => x.fn(this.open))
      this.queue = []
      this.buffer = []
    }
  }
}

let buffers = new WeakMap()

export function go(gen, done = (err, res) => { if(err) throw err }) {
  let finished = false, finishVal, errorVal, listeners = []
  // todo - check if already iter
  const iter = gen()
  function onError(err){
    finished = true 
    errorVal = err 
    done(err)
    listeners.forEach(fn => fn(err))
    listeners = []
    return 

  }
  // todo - try catch etc 
  function andThen(yieldedVal){
    let datum
    try{
     datum = iter.next(yieldedVal)  
    }
    catch(err) {
      onError(err)
      return 
    }

    if(datum.done) {

      finished = true
      finishVal = datum.value
      done(null, datum.value)
      listeners.forEach(fn => fn(null, datum.value))
      listeners = []
      return 
    }
    if(datum.value && datum.value[EFFECT]){
      switch(datum.value[EFFECT]){
        case 'put': {
          let { chan, value } = datum.value 
          try{
            buffers.get(chan).put(value, andThen)  
            return 
          }
          catch(err){
            onError(err)
            return 
          }
          
          
        }
        case 'take': {
          let { chan, value } = datum.value 
          buffers.get(chan).take(value, andThen) 
          return 
        }
        case 'cps': {
          let { fn } = datum.value 
          fn((err, x) => { 
            if(err) {
              // throw
            }
            andThen(x)
          })
          return 
        }
        default: throw new Error(datum.value[EFFECT]) // should never get here
      }
      
    }
    if(datum.value && datum.value[CHANNEL]){
      buffers.get(datum.value).take(andThen) 
      return 
      // do an implicit take 
    }
    if(datum.value){

      if(typeof datum.value === 'function'){
        let maybePromise = datum.value((err, res) => err ? onError(err) : andThen(res))
        if(maybePromise && maybePromise.then){
          // assume async fn, and the above callback would never be called 
          maybePromise.then(andThen, onError)          
        }
        
        return
      }
      if(typeof datum.value.then === 'function'){
        // thenable, promise 
        datum.value.then(andThen, onError)
        return 
      }
      else {
        andThen(datum.value)  
      }
    }
    else {
      andThen() // meh 
    }
    
  }
  // kick it off 

  andThen()

  return {
    [TASK]: true,
    cancel(e) {      
      // todo - stack
      iter.throw(e || new Cancellation('cancelled'))
    },
    onDone(fn) {
      if(finished) {
        if(errorVal){
          fn(errorVal)
        }
        else {
          fn(null, finishVal)
        }
      }
      else {
        listeners.push(fn)
      }
    }
  }

  

}

export function chan(bufferOrN, transducer, onErr) {
  if(bufferOrN === undefined){
    bufferOrN = new Buffer()
  }
  let b = bufferOrN >= 0 ? new Buffer({ length: bufferOrN}) : bufferOrN
  let c = { [CHANNEL]: true }
  buffers.set(c, b)
  return c
}

export function take(chan) {
  return {
    [EFFECT]: 'take', chan
  }
}

export function put(chan, value) {
  return {
    [EFFECT]: 'put', chan, value 
  }
}
export function timeout(n = 0) {
  return done => setTimeout(done, n)
}

// console.log(new Cancellation())



// export function offer(ch, value) {

// }

// export function poll(ch) {

// }

// export function alts(operations, options) {

// }

// export const buffers = {
//   fixed,
//   dropping,
//   sliding
// }



// cancel
// buffers
