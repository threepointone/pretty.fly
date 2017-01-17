pretty.fly
---

[very early work, ignore]

- primarily a learning exercise 
- small, simple 
- tree shakeable
- zero boilerplate 
- use channel as primary sync mechanism
- csp semantics where possible
- `go()` returns `Task`, cancelable 
- 'possibly sync' should work
- exceptions work as expected 

stretch goals
---

- buffers
- easy transducers 
- preserve stacks 
- testable 
- react 'integration'
- 'correctness'
- observables?

no
---

- async iterators (breaks 'possibly sync')
- make everyone happy

examples 
---
```jsx
import { chan, go, timeout, put, alts, frame, idle, cancelled } from 'pretty.fly'
```


```jsx
go(function*(){
  // simple timeout 
  yield timeout(500) // wait for half a second 
  console.log('waited!')

  // yield promises 
  let res = yield fetch('/api')
  // or async functions
  let res = yield async () => 123
  // or 'thunks'
  let res = yield done => superagent.get('/api').end(done)
  // or tasks itself 
  let val = yield go(function*(){
    yield timeout(200)
    return 123
  })


  // channels behave like clojure's ugly cousin
  let ch = chan() // default unbuffered 
  // start another loop to listen for puts
  go(function*(){
    while(true){
      console.log(yield ch /* same as `yield take(ch)` */)  
    }    
  })
  // put numbers on this channel forever
  while(true){
    yield put(ch, Math.random())
  }  
  // also - buffers, transducers, alts, etc 

  // animation loops via requestAnimationFrame
  while(true){
    yield frame() // wait for animation frame
    // do stuff
  }

  // idle callbacks via requestIdleCallback
  while(true) {
    let deadline = yield idle(200 /* optional timeout in ms */)
    while(!deadline.didTimeout && deadline.timeRemaining() > 0) {
      // do work
    }
  }

  // tasks can be cancelled 
  let task = go(function*(){
    try{
      while(true){
      yield timeout(500)
      console.log('tick')      
    }
    catch(err){
      if(cancelled(err)){
        console.error('cancelled!')
      }
    }
    
  })
  task.cancel()

  

})
```

