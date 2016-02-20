module.exports.consume = function (buffer) {
    //TODO: make this assert the ips and ports are correct

    var line = buffer.toString('utf8'),
        nextToken = line.indexOf('\r\n')

    if (nextToken < 0) {
        throw new Error('Expected \\r\\n but did not find one')
    }

    var parts = buffer.slice(0, nextToken).toString('utf8').split(' ')

    if (parts.length < 6) {
        throw new Error('Expected 6 parts for PROXY protocol got ' + parts.length)
    }

    if (parts[0] != 'PROXY') {
        throw new Error('Expect PROXY protocol but got ' + parts[0])
    }

    return {
        buffer: buffer.slice(nextToken + 2),
        proxy: {
            protocol: parts[1],
            clientIp: parts[2],
            proxyForIp: parts[3],
            clientPort: parts[4],
            proxyForPort: parts[5]
        }
    }
}
