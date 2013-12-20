var Message = require('../lib/Message')
  , should = require('should')

describe('Message', function () {

    it('Should initialize helper variables properly', function () {
        var message = new Message()
        if (message.socketId != void 0) {
            return new Error('socketId was not undefined')
        }

        if (message.acked != false) {
            return new Error('acked was not false')
        }
    })

})
