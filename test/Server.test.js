var Server = require('../lib/Server')
  , packageInfo = require('../package.json')
  , should = require('should')

describe('Server', function () {

    it('Should have constant constants', function () {
        Server.RELP_VERSION.should.equal('0', 'RELP_VERSION is wrong')
        Server.RELP_SOFTWARE.should.equal(
            'node-' + packageInfo.name + ',' + packageInfo.version + ',' + packageInfo.repository.url
          , 'RELP_SOFTWARE is wrong'
        )
        Server.RELP_COMMANDS.should.eql(
            ['open', 'close', 'syslog']
          , 'RELP_COMMANDS is wrong'
        )
    })

    describe('Constructor', function () {

        it('Should have a copy of the options provided')

        it('Should use net.Server if none is provided')

        it('Should not call listen on a server if one was provided')

        it('Should listen on the specified port if no server was provided')

        it('Should listen on the specified host if no server was provided')

        it('Should setup the server to listen for connections')

    })
})
