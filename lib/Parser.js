var EventEmitter = require('events').EventEmitter
  , util = require('util')
  , Message = require('./Message')

/**
 * Handles serializing and de-serializing RELP messages
 * Each connection should have a parser
 *
 * @constructor
 */
var Parser = function () {
    Parser.super_.call(this)

    this.buffer = new Buffer(0)
    this.currentMessage = null
}

util.inherits(Parser, EventEmitter)
module.exports = Parser

/**
 * Adds to the existing buffer and consumes it
 *
 * @param buffer
 */
Parser.prototype.consume = function (buffer) {
    var self = this

    this.buffer = Buffer.concat([this.buffer, buffer])

    /**
     * Buffer consumer that tries to be nice to the event loop
     */
    var consume = function () {
        var result

        if (self.currentMessage === null) {
            self.currentMessage = new Message()
        }

        try {
            result = self.deserialize(self.buffer, self.currentMessage)

        } catch (e) {
            /**
             * Error event that contains a caught exception
             *
             * @event Parser#error
             * @type {Error}
             */
            self.emit('error', e)
            return
        }

        self.buffer = self.buffer.slice(result.position)

        if (result.complete === false) {
            return
        }

        var emitMessage = self.currentMessage
        self.currentMessage = null

        if (self.buffer.length > 0) {
            process.nextTick(consume)
        }

        /**
         * Message event that contains a parsed Message
         *
         * @event Parser#message
         * @type {Message}
         */
        self.emit('message', emitMessage)
    }

    process.nextTick(consume)
}

/**
 * Attempts to consume an entire message from the buffer
 * If the buffer does not contain an entire message then `message` will be partial
 *
 * @param {String} buffer The buffer to consume serialized messages from
 * @param {Message} message The message to put deserialized parts onto
 *
 * @returns {{complete: boolean, position: number}} An object describing the state of the message being parsed and the
 *      position in the buffer we got to
 */
Parser.prototype.deserialize = function (buffer, message) {
    /*
    NOTE: Node doesn't provide a good way to read bytes until reaching a specific character, outside of ReadLine.
    For most of this we read utf pessimistically until we get to the message body, since that is the only time we
    know the full size of what we need to read

    TODO: In node 10 we are going to have some issues with the backwards compat breaks in how Buffer works
     */
    var parsedPosition = 0,
        nextToken = 0,
        header = ''

    if (message.transactionId === void 0) {
        header = buffer.toString('utf8', 0, 10)
        nextToken = header.indexOf(' ', parsedPosition)

        if (nextToken === -1 && header.length > 9) {
            throw new Error('Expected transaction id, got something longer than 9 characters')
        } else if (nextToken === 0) {
            throw new Error('Expected transaction id, got a space instead')
        } else if (nextToken < 0) {
            return { complete: false, position: parsedPosition }
        }

        var transactionId = parseInt(header.slice(parsedPosition, nextToken))
        if (isNaN(transactionId)) {
            throw new Error('Expected transaction id to be a number, got something else')
        }

        message.transactionId = transactionId
        parsedPosition = nextToken + 1
    }

    if (message.command === void 0) {
        header = buffer.toString('utf8', parsedPosition, parsedPosition + 33)
        nextToken = header.indexOf(' ')

        if (nextToken === -1 && header.length > 32) {
            throw new Error('Expected command, got something longer than 32 characters')
        } else if (nextToken === 0) {
            throw new Error('Expected command, got a space instead')
        } else if (nextToken < 0) {
            return { complete: false, position: parsedPosition }
        }

        message.command = header.slice(0, nextToken)
        parsedPosition += nextToken + 1
    }

    if (message.bodyLength === void 0) {
        header = buffer.toString('utf8', parsedPosition, parsedPosition + 10)

        //No space after body length if it is 0
        if (header[0] === '0') {
            message.bodyLength = 0
            parsedPosition++

        } else {
            nextToken = header.indexOf(' ')

            if (nextToken > 10 || (nextToken === -1 && header.length > 9)) {
                throw new Error('Expected bodyLength, got something longer than 9 characters')
            } else if (nextToken === 0) {
                throw new Error('Expected bodyLength, got a space instead')
            } else if (nextToken < 0) {
                return { complete: false, position: parsedPosition }
            }

            var bodyLength = parseInt(header.slice(0, nextToken))
            if (isNaN(bodyLength)) {
                throw new Error('Expected bodyLength to be a number, got something else')
            }

            message.bodyLength = bodyLength
            parsedPosition += nextToken + 1
        }
    }

    if (message.body === void 0) {
        var start = parsedPosition + message.bodyLength

        if ((buffer.length - parsedPosition) < message.bodyLength + 1) {
            return { complete: false, position: parsedPosition }
        } else if (buffer.toString('utf8', start, start + 1) !== '\n') {
            //TODO: Figure out why this is happening, maybe not recieved it all yet?
            throw new Error('Expected ending newline, got something else')
        }

        message.body = buffer.toString('utf8', parsedPosition, parsedPosition + message.bodyLength)

        parsedPosition = parsedPosition + message.bodyLength + 1
    }

    return { complete: true, position: parsedPosition }
}

/**
 * Serializes a RELP message for transmission over the wire
 *
 * @param {Message} message The RELP message to serialize
 *
 * @returns {string} The serialized string, ready to transmit
 */
Parser.prototype.serialize = function (message) {
    //TODO: should probably guard this a bit, id is a number, bodyLength is a number, things aren't too long etc
    var buffer = []

    buffer.push(message.transactionId)
    buffer.push(message.command)

    if (message.body) {
        buffer.push(Buffer.byteLength(message.body))
        buffer.push(message.body)
    } else {
        buffer.push('0')
    }

    return buffer.join(' ') + '\n'
}
