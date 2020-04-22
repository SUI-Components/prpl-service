const http = require('http')
const prplFromURL = require('./api')

http.createServer(prplFromURL).listen(1337, () => {
  console.log(`Server started at http://localhost:1337`)
})
