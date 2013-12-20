var Parser = require('../lib/Parser')
  , Message = require('../lib/Message')
  , should = require('should')
  , nextTick = process.nextTick

describe('Parser', function () {

    describe('Serialize', function () {

        it('Should properly serialize a message with a body', function () {
            var parser = new Parser()
              , buffer = parser.serialize(new Message('1', 'syslog', 'some junk'))

            buffer.should.equal('1 syslog 9 some junk\n', 'Serialized message was incorrect')
        })

        it('Should properly serialize a message with a body that has multiple lines', function () {
            var parser = new Parser()
              , buffer = parser.serialize(new Message('1', 'syslog', 'another\nline\nof\njunk'))

            buffer.should.equal('1 syslog 20 another\nline\nof\njunk\n', 'Serialized message was incorrect')
        })

        it('Should properly serialize a message without a body', function () {
            var parser = new Parser()
              , buffer = parser.serialize(new Message('1', 'syslog'))

            buffer.should.equal('1 syslog 0\n', 'Serialized message was incorrect')
        })

        it('Should properly serialize a message with unicode characters in the body', function () {
            var parser = new Parser()
              , buffer = parser.serialize(new Message('1', 'syslog', 'aía'))

            buffer.should.equal('1 syslog 4 aía\n', 'Serialized message was incorrect')
        })

    })

    describe('Deserialize', function () {
        it('Should not deserialize anything if there is not enough in the buffer to get the transaction id', function () {
            var parser = new Parser()
              , message = new Message()
              , result = parser.deserialize('100', message)

            result.complete.should.equal(false, 'Message should not be completed')
            result.position.should.equal(0, 'Should not have parsed into the buffer at all')
        })

        it('Should throw an error if the transaction id is longer than 9 characters', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize('1234567890', message)
            } catch (error) {
                error.message.should.equal(
                    'Expected transaction id, got something longer than 9 characters'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should throw an error if there is a space where the transaction id should be', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(' ', message)
            } catch (error) {
                error.message.should.equal(
                    'Expected transaction id, got a space instead'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should throw an error if the transaction id was not a number', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize('a ', message)
            } catch (error) {
                error.message.should.equal(
                    'Expected transaction id to be a number, got something else'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should stop after the transaction id if there is not enough buffer for the command', function () {
            var parser = new Parser()
              , message = new Message()
              , result = parser.deserialize(new Buffer('123456789 '), message)

            result.complete.should.equal(false, 'Message should not be completed')
            result.position.should.equal(10, 'Parsed too far into the buffer')

            message.transactionId.should.equal(123456789, 'Transaction id was wrong')
        })

        it('Should throw an error if the command is longer than 32 characters', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(new Buffer('1 12345678901234567890123456789012A '), message)
            } catch (error) {
                error.message.should.equal(
                    'Expected command, got something longer than 32 characters'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should throw an error if there is a space where the command should be', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(new Buffer('1  '), message)
            } catch (error) {
                error.message.should.equal(
                    'Expected command, got a space instead'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should stop after the command if there is not enough buffer for the bodyLength', function () {
            var parser = new Parser()
              , message = new Message()

            var result = parser.deserialize(new Buffer('1 12345678901234567890123456789012 '), message)
            result.complete.should.equal(false, 'Message should not be completed')
            result.position.should.equal(35, 'Parsed too far into the buffer')

            message.transactionId.should.equal(1, 'Transaction id was wrong')
            message.command.should.equal('12345678901234567890123456789012', 'Command was wrong')
        })

        it('Should throw an error if the bodyLength is longer than 9 characters', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(new Buffer('1 command 1234567890 '), message)
            } catch (error) {
                error.message.should.equal(
                    'Expected bodyLength, got something longer than 9 characters'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should throw an error if the bodyLength is not a number', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(new Buffer('1 command a '), message)
            } catch (error) {
                error.message.should.equal(
                    'Expected bodyLength to be a number, got something else'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should throw an error if there is a space where the bodyLength should be', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(new Buffer('1 command  '), message)
            } catch (error) {
                error.message.should.equal(
                    'Expected bodyLength, got a space instead'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should stop after the bodyLength if there is not enough buffer for the body', function () {
            var parser = new Parser()
              , message = new Message()

            var result = parser.deserialize(new Buffer('1 command 123456789 1'), message)
            result.complete.should.equal(false, 'Message should not be completed')
            result.position.should.equal(20, 'Parsed too far into the buffer')

            message.transactionId.should.equal(1, 'Transaction id was wrong')
            message.command.should.equal('command', 'Command was wrong')
            message.bodyLength.should.equal(123456789, 'Body length was wrong')
        })

        it('Should throw an error if there is data at the end of the body', function () {
            var parser = new Parser()
              , message = new Message()

            try {
                parser.deserialize(new Buffer('1 command 1 11'), message)
            } catch (error) {
                error.message.should.equal(
                    'Expected ending newline, got something else'
                  , 'Error message is wrong'
                )
                return
            }

            return new Error('Should have caught an error')
        })

        it('Should completely parse a message if the buffer contains one', function () {
            var parser = new Parser()
              , message = new Message()

            var result = parser.deserialize(new Buffer('1 command 1 a\n'), message)
            result.complete.should.equal(true, 'Message was not completed')
            result.position.should.equal(14, 'Parsed too far into the buffer')

            message.transactionId.should.equal(1, 'Transaction id was wrong')
            message.command.should.equal('command', 'Command was wrong')
            message.bodyLength.should.equal(1, 'Body length was wrong')
            message.body.should.equal('a', 'Body was wrong')
        })

        it('Should completely parse a message with no body', function () {
            var parser = new Parser()
              , message = new Message()

            var result = parser.deserialize(new Buffer('1 command 0\n'), message)
            result.complete.should.equal(true, 'Message was not completed')
            result.position.should.equal(12, 'Parsed too far into the buffer')

            message.transactionId.should.equal(1, 'Transaction id was wrong')
            message.command.should.equal('command', 'Command was wrong')
            message.bodyLength.should.equal(0, 'Body length was wrong')
            message.body.should.equal('', 'Body was wrong')
        })

        it('Should leave the message alone and not parse anything if the message is complete', function () {
            var parser = new Parser()
              , message = new Message()

            var result = parser.deserialize(new Buffer('1 command 0\n'), message)
            result.complete.should.equal(true, 'Message was not completed')
            result.position.should.equal(12, 'Parsed too far into the buffer')

            result = parser.deserialize('1 command 0\n', message)
            result.complete.should.equal(true, 'Message was not completed')
            result.position.should.equal(0, 'Parsed too far into the buffer')
            message.transactionId.should.equal(1, 'Transaction id was wrong')
            message.command.should.equal('command', 'Command was wrong')
            message.bodyLength.should.equal(0, 'Body length was wrong')
            message.body.should.equal('', 'Body was wrong')
        })

        it('Should properly deserialize a message with unicode characters in the body', function (done) {
            var parser = new Parser()
              , messages = 0

            parser.on('message', function (message) {
                messages++
                message.body.should.equal(messages == 2 ? 'a' : 'ía')

                if (messages == 3) {
                    done()
                }
            })

            parser.consume(new Buffer('1 syslog 3 ía\n2 syslog 1 a\n3 syslog 3 ía\n'))
        })

    })

    describe('Consuming', function () {
        afterEach(function () {
            process.nextTick = nextTick
        })

        it('Should append to the buffer on each call to consume', function (done) {
            var parser = new Parser()
              , deserializeCalled = 0

            parser.deserialize = function (buffer) {
                deserializeCalled++

                if (deserializeCalled == 1) {
                    buffer.toString().should.equal('1', 'First consume call; buffer value is wrong')
                } else if (deserializeCalled == 2) {
                    buffer.toString().should.equal('12', 'Second consume call; buffer value is wrong')
                    done()
                } else {
                    done(new Error('Something weird is going on'))
                }

                return { complete: false, position: 0 }
            }

            process.nextTick = function (func) {
                func()
            }

            parser.consume(new Buffer('1'))
            parser.consume(new Buffer('2'))
        })

        it('Should emit a message event on a completed message', function (done) {
            var parser = new Parser()
              , messages = 0

            parser.on('message', function (message) {
                message.transactionId.should.equal(++messages, 'Transaction id was wrong')
                message.command.should.equal('command', 'Command was wrong')
                message.bodyLength.should.equal(1, 'Body length was wrong')
                message.body.should.equal('a', 'Body was wrong')

                if (messages == 2) {
                    done()
                }
            })

            parser.consume(new Buffer('1 command 1 a\n2 command 1 a\n'))
        })

        it('Should properly consume messages across packets', function (done) {
            var parser = new Parser()

            parser.on('message', function (message) {
                message.transactionId.should.equal(1, 'Transaction id was wrong')
                message.command.should.equal('command', 'Command was wrong')
                message.bodyLength.should.equal(1, 'Body length was wrong')
                message.body.should.equal('a', 'Body was wrong')
                done()
            })

            parser._deserialize = parser.deserialize
            parser.deserialize = function (buffer, message) {
                var result = parser._deserialize(buffer, message)
                parser.consume(new Buffer('and 1 a\n'))
                parser.deserialize = parser._deserialize
                return result
            }

            parser.consume(new Buffer('1 comm'))
        })

        it('Should emit an error if deserialize throws one', function (done) {
            var parser = new Parser()

            parser.on('error', function () {
                done()
            })

            parser.consume(new Buffer('asdf asdf asdf'))
        })

    })

})
