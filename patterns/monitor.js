

    // https://en.wikipedia.org/wiki/Monitor_(synchronization)
    import { go, chan, put, timeout } from '../src'

    let balance = 0, // starting account balance
      txns = chan() // unbuffered, standard channel

    function withdraw(amount){
      return go(function*(){
        yield put(txns, { type: 'withdraw', amount })
      })
    }

    function deposit(amount){
      go(function*(){
        yield put(txns, { type: 'deposit', amount })
      })
    }

    // start processing 
    go(function*(){
      while(true){
        let { type, amount } = yield txns
        yield timeout(200) // simulate some work
        balance = type ==='withdraw' ? 
          balance - amount : 
          balance + amount
        console.log({ type, amount, balance })
      }  
    })

    // simulate some transactions 
    go(function*(){
      let ctr = 100
      while(ctr > 0) {
        yield timeout(Math.random());
        ((Math.random() > 0.5) ? withdraw : deposit)
          (Math.round(Math.random() * 1000))
        ctr -- 
      }
    })

    