[![Build Status](https://travis-ci.org/nbrownus/node-relp-lib.png?branch=master)](https://travis-ci.org/nbrownus/node-relp-lib)

Implements the RELP protocol for use in node projects

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
- Catch parse errors and disconnect the server
- Ensure transaction id increments monotonically and disconnect if not
- Fix socket id stuff, using array index is borked
