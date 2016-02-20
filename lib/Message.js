/**
 * A RELP message
 * Also contains `remoteAddress`,`socketId`, and `acked` for consumer information
 *
 * @param {String} transactionId The client transaction id
 * @param {String} command The command of the message, `syslog`, `open`, `close`, etc
 * @param {String} body Body of the command, usually a log line or a handshake
 *
 * @constructor
 */
var Message = function (transactionId, command, body) {
    this.transactionId = transactionId
    this.command = command
    this.body = body

    this.socketId = void 0
    this.remoteAddress = void 0
    this.acked = false
}

module.exports = Message
