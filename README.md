[![Build Status](https://travis-ci.org/nbrownus/node-relp.png?branch=master)](https://travis-ci.org/nbrownus/node-relp)

Implements the RELP protocol for use in node projects

- Supports [PROXY protocol](http://www.haproxy.org/download/1.5/doc/proxy-protocol.txt)

[RELP Protocol](http://www.rsyslog.com/doc/relp.html)

[rsyslog Homepage](http://www.rsyslog.com)

### Examples

The following example will setup a server and print all messages coming and going from a RELP client

    node examples/server

### Testing

To run the unit tests, use

    make test

There is also a cli coverage analysis

    make test-cov

As well as a nice html output

    make test-cov-html

Provided by [ppunit](https://github.com/nbrownus/ppunit) and [istanbul](https://github.com/gotwarlost/istanbul)

### TODO

- Build a RELP client
- Make sure to test parse errors/trying to syslog before open closes the socket
- Ensure transaction id increments monotonically and disconnect if not
