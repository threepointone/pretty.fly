
// timeouts and cancellations
{
  let t = go(function*(){
    try{
      let start = new Date().getTime()/1000  
      yield timeout(500)
      console.log(new Date().getTime()/1000 - start)    
    }
    catch(e){
      console.log(e instanceof Cancellation)
      console.error(e)   
    }
  })

  t.cancel()

}


// ping pong 
{
  let c = chan()

  let player1 = go(function*(){
    while(true){    
      yield c
      yield timeout(1000)  
      console.log('ping')
      yield put(c, 'ping')      
    }
  })

  let player2 = go(function*(){
    while(true){    
      yield c
      yield timeout(1000)
      console.log('pong')
      yield put(c, 'pong')      
    }
  })

  go(function*(){
    yield put(c, 'start')
    yield timeout(5000)
    player1.cancel()
  })
}
