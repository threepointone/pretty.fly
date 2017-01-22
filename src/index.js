
let EFFECT = Symbol('EFFECT')
let CHANNEL = Symbol('CHANNEL')
let TASK = Symbol('TASK')
let CLOSED = Symbol('CLOSED')
let CANCELLED = Symbol('CANCELLED')


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
  unbind = el => {
    if(el){
      if(typeof el === 'function'){
        this.takers = this.takers.filter(x => x !== el)  
        return 
      }
      this.queue = this.queue.filter(x => x !== el)
      this.buffer = this.buffer.filter(x => x !== el)
      if(this.buffer.length < this.maxLength && this.queue.length > 0){
        let x  = this.queue.shift()
        x.buffered = true
        this.buffer.push(x)
        // move to buffer 
      }  
    }    
  }
  
  put(val, fn) {
    if(!this.open){
      fn(this.open)
      return       
    }
    if(this.takers.length > 0){
      let taker = this.takers.shift()
      taker(val)
      fn(this.open)
      return
    }

    if(this.buffer.length === this.maxLength){   
      let el = { val, fn }
      this.queue.push(el)  
      return el
    }
    let el = { val, buffered: true }
    this.buffer.push(el)
    fn(this.open)
    return el 
  }
  take(fn) {
    let datum

    datum = this.buffer.length > 0 ? this.buffer.shift() : 
      this.queue.length > 0 ? this.queue.shift() : 
      null
    if(this.buffer.length < this.maxLength && this.queue.length > 0){
      // move an element from queue to buffer
      let el = this.queue.shift()
      el.buffered = true
      this.buffer.push(el)
      fn(this.open)
    }
    if(datum) {
      fn(datum.val)
      if(!datum.buffered) {
        datum.fn(this.open)
      }
    }
    else {
      if(this.open){
        this.takers.push(fn)
        return fn 
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
    // todo - don't cancel pending puts (takes?)
    // if(this.queue.length > 0){
    //   this.queue.forEach(x => x.fn(this.open))
    //   this.queue = []
    //   this.buffer = []
    // }
  }
}

let buffers = new WeakMap()

export function go(gen, done = (err, res) => { if(err) throw err }) {
  let finished = false, finishVal, errorVal, listeners = [], isCancelled = false, cancelReturn
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
  
  
  function andThen(yieldedVal){
    let datum
    try{
     
     if(isCancelled && cancelReturn.value && cancelReturn.value[EFFECT] === 'cancelled'){
      datum = iter.next(true)   
     }
     else {
      datum = iter.next(yieldedVal)    
     }
    }
    catch(err) {
      onError(err)
      return 
    }
    

    if(datum.done) {
      finished = true
      finishVal = datum.value
      done(undefined, datum.value)
      listeners.forEach(fn => fn(undefined, datum.value))
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
        case 'cancelled': {          
          andThen(isCancelled)
          return 
        }
        case 'alts': {
          let { operations /*, opts = {} */} = datum.value
          // opts.priority
          // opts.default
          // check syncly for any buffered
          // check syncly for any queued 
          // make choice 
          // else add listener 

          let unlistens = []
          let donehere = false 
          function win(val, i){
            donehere = true 

            unlistens.splice(i, 1).forEach(f => f())
            andThen({ channel: operations[i], value: val })
            // remove all other listeners 
          }
          
          operations.forEach((op, i) => {
            // take 
            if(!donehere){
              if(op[EFFECT] === 'put'){
                let tok = buffers.get(op.chan).put(op.value, x => win(x, i))  
                unlistens.push(() => buffers.get(op.chan).unbind(tok))
              }
              else {
                let tok = buffers.get(op).take(x => win(x, i))  
                unlistens.push(() => buffers.get(op).unbind(tok))
              }
            }
            
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
      if(!isCancelled){
        isCancelled = true
        cancelReturn = iter.return(CANCELLED)
        return true
      }
      return false 
      
    },
    onDone(fn) {
      if(finished) {
        if(errorVal){
          fn(errorVal)
        }
        else {
          fn(undefined, finishVal)
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

export function cancelled(){
  return {
    [EFFECT]: 'cancelled'
  }
}


export function timeout(n = 0) {
  return done => setTimeout(() => done(), n)
}


export function frame(){
  return done => requestAnimationFrame(time => done(undefined, time))
}

export function immediate(){
  return done => setImmediate(() => done())
}

export function idle(){
  return done => requestIdleCallback(deadline => done(undefined, deadline))
}

export function alts(operations, opts) {
  return {
    [EFFECT]: 'alts', operations, opts
  }
}

export function offer(ch, val) {

}

export function poll(ch) {

}

export function fixed(n) {

}

export function dropping(n) {

}

export function sliding(n) {

}



// export const buffers = {
//   fixed,
//   dropping,
//   sliding
// }



// cancel
// buffers

// let cache = chan()
// go(function(){})