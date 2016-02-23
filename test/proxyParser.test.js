var proxyParser = require('../lib/proxyParser'),
    should = require('should')

describe('proxyParser', function () {

    it('Should parse the PROXY header', function () {
        var result = proxyParser.consume(
            new Buffer('PROXY TCP4 10.7.254.51 10.0.30.19 45219 5515\r\n')
        )

        result.buffer.toString().should.eql('')
        result.proxy.should.eql({
            clientIp: '10.7.254.51',
            clientPort: '45219',
            protocol: 'TCP4',
            proxyIp: '10.0.30.19',
            proxyPort: '5515'
        })
    })

    it('Should handle more than just PROXY in a single packet', function () {
        var result = proxyParser.consume(
            new Buffer('PROXY TCP4 10.7.254.51 10.0.30.19 45219 5515\r\n1 open 14 relp_version=1\n')
        )

        result.buffer.toString().should.eql('1 open 14 relp_version=1\n')
    })

    it('Should throw an error on malformed protocol', function () {
        assertError(
            new Buffer('PROXY TCP4 10.7.254.51 10.0.30.19 5515 234'),
            'Expected \\r\\n but did not find one'
        )

        assertError(
            new Buffer('PROXY TCP4 10.7.254.51 10.0.30.19 45219\r\n'),
            'Expected 6 parts for PROXY protocol got 5'
        )

        assertError(
            new Buffer('DERP DERP DERP DERP DERP DERP\r\n'),
            'Expect PROXY protocol but got DERP'
        )
    })
})

var assertError = function (buffer, error) {
    try {
        proxyParser.consume(buffer)
    } catch (e) {
        e.message.should.eql(error)
        return
    }

    throw new Error('Expected an error')
}
