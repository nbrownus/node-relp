var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    net = require('net'),
    Parser = require('./Parser'),
    Message = require('./Message'),
    packageInfo = require('../package.json'),
    proxyParser = require('./proxyParser')

/**
 * Handles relp client communication
 * Will emit new messages and connection closes for the consumer to act on
 * If a connection closes, non ack'd messages should be dropped since they will be retransmitted
 *
 * @param {Object} options Configuration options for the server
 * @param {Number} options.port The port to listen for new connections
 * @param {String} [options.host] The host to listen for new connections on
 * @param {Server} [options.server] Configure your own server and provide it here
 *      You must call listen on the provided server object
 * @param {Boolean} [options.proxyProtocol=false] True to expect PROXY protocol, false if not
 * @param {Object} [options.parser=Parser] A custom parser, if you must
 * @param {Object} [options.proxyParser=proxyParser] A custom PROXY protocol parser, if you must
 * @param {Object} [options.logger] A logger to use in place of console
 *
 * @constructor
 */
var Server = function (options) {
    Server.super_.call(this)

    var self = this

    self.options = options
    self.logger = options.logger || console
    self.sockets = {}
    self._nextSocketId = 1

    self.paused = false
    self.server = options.server || net.createServer()

    self.server.on('connection', function (socket) {
        self._setupConnection(socket)
    })

    self.server.on('error', function (error) {
        console.log('ACK', error.stack)
    })

    if (!options.server) {
        self.server.listen(options.port, options.host)
    }
}

Server.RELP_VERSION = '0'
Server.RELP_SOFTWARE = 'node-' + packageInfo.name + ',' + packageInfo.version + ',' + packageInfo.repository.url
Server.RELP_COMMANDS = ['open', 'close', 'syslog']

util.inherits(Server, EventEmitter)
module.exports = Server

/**
 * Acknowledges the receipt of a relp message to the relp client
 * Messages with a transaction id below 1 will not be ack'd
 * Messages that have already been ack'd will not be re-ack'd
 *
 * @param {Message} message A relp message to ack
 * @param {String} [data='200 OK'] Data to send
 * @param {boolean} [close=false] Whether or not to close the socket after sending
 *
 * @returns {boolean} True if the message was ack'd, false if not
 */
Server.prototype.ack = function (message, data, close) {
    var self = this
      , socket = self.sockets[message.socketId]
      , actualData = data || '200 OK'

    if (!socket || message.transactionId < 1 || message.acked) {
        return false
    }

    var ackMessage = new Message(message.transactionId, 'rsp', actualData)
      , buffer = socket.parser.serialize(ackMessage)

    if (close) {
        socket.end(buffer)
    } else {
        socket.write(buffer)
    }

    message.acked = true
    return true
}

/**
 * Pauses all existing and future connections
 * You must resume before seeing anymore messages
 *
 * @return {boolean} True on success, false if already paused
 */
Server.prototype.pause = function () {
    if (this.paused) {
        return false
    }

    for (var socketId in this.sockets) {
        this.sockets[socketId].pause()
    }

    this.paused = true
    return true
}

/**
 * Resumes a previously paused server
 * Expect a flood of messages!
 *
 * @returns {boolean} True on success, false if not already paused
 */
Server.prototype.resume = function () {
    if (!this.paused) {
        return false
    }

    for (var socketId in this.sockets) {
        this.sockets[socketId].resume()
    }

    this.paused = false
    return true
}

/**
 * Closes each open connection and finally the server
 */
Server.prototype.close = function () {
    this.server.close()

    for (var socketId in this.sockets) {
        this.sockets[socketId].end()
    }
}

/**
 * Dispatches a message to the proper handler
 *
 * @param {Message} message The message to handle
 *
 * @private
 */
Server.prototype._handleMessage = function (message) {
    var self = this,
        socket = this.sockets[message.socketId]

    switch (message.command) {
        case 'syslog':
            //Are we getting messages before the handshake?
            if (socket.relpHandshakeComplete === false) {
                //TODO: emit?
                self.logger.error(
                    'Connection id', message.socketId, 'sent a syslog message before the handshake, disconnecting'
                )

                return socket.destroy()
            }

            this.emit('message', message)
            break

        case 'open':
            this._handleOpen(message)
            break

        case 'close':
            this._handleClose(message)
            break

        default:
            //TODO: emit?
            self.logger.error('Connection id', message.socketId, 'sent an unknown command:', message.command)
            return socket.destroy()
    }
}

/**
 * Handles the open message
 * This is what starts a relp session
 *
 * @param {Message} message The open message to work from
 *
 * @private
 */
Server.prototype._handleOpen = function (message) {
    var self = this
      , rawOffers = message.body.split('\n')
      , offers = {}
      , body

    rawOffers.forEach(function (rawOffer) {
        var parts = rawOffer.split('=')
        offers[parts[0]] = parts[1]
    })

    if (offers['relp_version'] !== Server.RELP_VERSION) {
        body = '500 Insufficient version\n'
            + Server.RELP_VERSION + ' required, ' + offers['relp_version'] + ' provided'
        return self.ack(message, body, true)
    }

    if (!offers['commands']) {
        body = '500 No commands provided'
        return self.ack(message, body, true)
    }

    offers['commands'].split(',').some(function (command) {
        if (Server.RELP_COMMANDS.indexOf(command.trim().toLowerCase()) === -1) {
            body = '500 Invalid command\n'
                + command + ' is not supported'

            return self.ack(message, body, true)
        }
    })

    body = '200 OK '
        + 'relp_version=' + Server.RELP_VERSION + '\n'
        + 'relp_software=' + Server.RELP_SOFTWARE + '\n'
        + 'commands=' + offers['commands']

    self.ack(message, body)
    self.sockets[message.socketId].relpHandshakeComplete = true
}

/**
 * Handles a close message
 * Acks the message and closes the socket
 *
 * @param {Message} message The close message to work from
 *
 * @private
 */
Server.prototype._handleClose = function (message) {
    this.ack(message, '', true)
}

/**
 * Sets up a connection to be managed
 * Handles new messages, socket closes/opens, etc
 *
 * @param {Socket} socket The socket to handle events for
 *
 * @private
 */
Server.prototype._setupConnection = function (socket) {
    if (this.paused) {
        socket.pause()
    }

    var self = this,
        useParser = self.options.parser || Parser,
        useProxyParser = self.options.proxyParser || proxyParser

    socket.socketId = self._nextSocketId++
    self.sockets[socket.socketId] = socket

    socket.parser = new useParser()

    socket.proxyHandshakeComplete = false
    socket.relpHandshakeComplete = false

    socket.parser.on('error', function (error) {
        self.logger.error('Connection #', socket.socketId, 'had a parse error, disconnecting.', error)
        socket.destroy()
    })

    socket.parser.on('message', function (message) {
        message.socketId = socket.socketId
        message.remoteAddress = socket.remoteAddress
        message.proxyAddress = socket.proxyAddress
        self._handleMessage(message)
    })

    socket.on('data', function (data) {
        if (self.options.proxyProtocol && socket.proxyHandshakeComplete === false) {
            var result = useProxyParser.consume(data)
            socket.proxyHandshakeComplete = true
            socket.proxyAddress = result.proxy.proxyForIp
            data = result.buffer
        }

        socket.parser.consume(data)
    })

    socket.on('error', function (error) {
        self.logger.error('Connection #', socket.socketId, 'had an error:', error)
        socket.destroy()
    })

    socket.on('close', function () {
        /**
         * Notifies consumers that a client connection has closed and is about to be unreferenced
         *
         * @event Server#connectionClosed
         * @type {Socket} The socket that closed
         * @property {Number} socketId The id of the socket that was closed, any non ack'd message with this
         *      socketId should stop processing to avoid duplicates
         */
        self.emit('connectionClosed', socket)

        delete self.sockets[socket.socketId]
    })

    /**
     * Notifies consumers that a new client connection has opened
     *
     * @event Server#connectionOpened
     * @type {Socket} The socket that opened
     * @property {Number} socketId the id of the socket that just opened, all messages received on this connection
     *      will contain this socketId
     */
    self.emit('connectionOpened', socket)
}
