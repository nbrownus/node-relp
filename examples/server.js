var Server = require('../lib/Server')

var server = new Server({ port: '4981' })

server.on('connectionOpened', function (socket) {
    console.log('* New connection:', socket.socketId)
    socket.origWrite = socket.write
    socket.write = function () {
        arguments[0].split('\n').forEach(function (line) {
            console.log('<', line)
        })
        socket.origWrite.apply(socket, arguments)
    }
})

server.on('connectionClosed', function (socket) {
    console.log('* Closed connection:', socket.socketId)
})

server.on('message', function (message) {
    console.log('> Transaction Id:', message.transactionId)
    console.log('> Command:', message.command)
    console.log('>')

    message.body.split('\n').forEach(function (line) {
        console.log('>', line)
    })

    server.ack(message)
})
