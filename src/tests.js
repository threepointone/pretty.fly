import tap from 'tap'
import { go, timeout } from './'

tap.test('simple', $ => {  
  let sync = true
  go(function*(){
    yield 456
    return 123
  }, (err, val) => {

    $.ok(val === 123)
    $.ok(err === undefined)
    $.ok(sync === true)
    $.end()        
  })
  sync = false 
})

tap.test('errors', $ => {
  $.plan(3)

  go(function*(){
    throw new Error()
  }, err => {
    $.ok(err instanceof Error)    
  })

  go(function*(){
    try{
      throw 123
    }
    catch(e){
      $.ok(e === 123)      
    }    
  })

  go(function*(){
    try{
      yield go(function*(){
        throw 123
      })
    }
    catch(e){
      $.ok(e === 123)
      $.end()
    }
  })
})

tap.test('canceling', $ => {
  $.plan(3)
  
  let t1 = go(function*(){
    yield 123
  })
  $.ok(t1.cancel())
  $.ok(!t1.cancel())
  
  let flag = false 
  let t2 = go(function*(){
    yield timeout(500)
    flag = true 
  })

  go(function*(){

    yield timeout(300)
    t2.cancel()
    yield timeout(300)

    $.ok(!flag)
    $.end()
  })
})

// cancel

tap.test('timeout', $ => {
  let start = new Date().getTime()
  go(function*(){
    yield timeout(500)
    return 123
  }, (err, val) => {
    $.ok(val === 123)
    let delta = (new Date().getTime() - start)/1000
    // js timers, amirite 
    $.ok(delta > 0.4)
    $.ok(delta < 0.6)
    $.end()
  })
})

