describe('pretty.fly', () => {
  it('one', () => {
    let sync = true
    go(function*(){
      return 123
    }, (err, val) => {
      expect(val).toEqual(123)
      expect(err).toEqual(undefined)
      expect(sync).toEqual(true)
      done()
    })
    sync = false 

  })

})

