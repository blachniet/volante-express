const volante = require('volante');
const express = require('express');
const onFinished = require('on-finished');

//
// Volante module providing an express.js server
//
class VolanteExpress extends volante.Spoke {
  //
  // volante init()
  //
  init() {
    // default options
    this.options = {
      bind: '127.0.0.1',
      port: 3000,
      logging: true,
      middleware: []
    };

    this.hub.on('volante-express.options', (opts) => {
      Object.assign(this.options, opts);
      this.configure();
    });
    this.hub.on('volante-express.use', (middleware) => {
      this.app && this.app.use(middleware);
    });
    this.hub.on('volante-express.start', () => this.start());
    this.hub.on('volante-express.stop', () => this.stop());
  }

  configure() {
    this.debug('starting express.js');
    // instantiate the express app
    this.app = express();
    this.app.disable('x-powered-by');

    // logging middleware
    this.app.use((req, res, next) => this.loggingMiddleware(req, res, next));

    // load user-specified middleware
    for (let mw of this.options.middleware) {
      this.app.use(mw);
    }
  }

  start() {
    this.server = require('http').Server(this.app);

    this.server.on('error', (err) => {
      switch (err.code) {
        case 'EADDRINUSE':
          this.error(`Port ${this.options.port} is already in use, is another instance running?`);
          break;
        default:
          this.error(`unable to open listen port: ${err}`);
      }
      this.shutdown(); // dealbreaker
    });

    this.server.listen(this.options.port, this.options.bind, () => {
      this.hub.emit('volante-express.listening', {
        bind: this.options.bind,
        port: this.options.port
      });
      this.log(`listening in ${this.app.get('env')} mode for HTTP on ${this.options.bind}:${this.options.port}`);
    });
  }

  //
  // lightweight-logging middleware which calls the built-in Volante .log() function
  //
  loggingMiddleware(req, res, next) {
    if (this.options.logging) {
      // starting datum
      let startAt = process.hrtime();

      // use on-finished module to log when HTTP request is finished
      onFinished(res, () => {
        let diff = process.hrtime(startAt);
        let ms = diff[0] * 1e3 + diff[1] * 1e-6;

        this.log({
          method: req.method, // HTTP method
          src: req.ip || req._remoteAddress || (req.connection && req.connection.remoteAddress), // src IP address
          url: req.originalUrl || req.url, // url
          ms // response time in milliseconds
        });
      });
    }
    next();
  }
}

//
// exports
//
module.exports = VolanteExpress;