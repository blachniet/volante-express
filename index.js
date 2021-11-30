const express = require('express');
const onFinished = require('on-finished');
const bodyParser = require('body-parser');
const cors = require('cors');

//
// Volante module providing an express.js server
//
module.exports = {
  name: 'VolanteExpress',
  props: {
    bind: '127.0.0.1',        // ip address to bind, use 0.0.0.0 for all interfaces
    port: 3000,               // port to bind
    https: false,             // flag for https mode
    key: null,                // key buffer, e.g. from fs.readFileSync('key.pem')
    cert: null,               // cert buffer, e.g. from fs.readFileSync('cert.pem')
    logging: true,            // flag for adding volante logging middleware to express
    cors: '*',                // cors origin, see https://www.npmjs.com/package/cors#configuration-options
    middleware: [],           // middleware array, for manually entered (see test code at bottom)
    errorOnBindFail: true,    // flag for whether this module should request a shutdown if it can't bind
    bodyParserLimit: '100mb', // body parser size limit
  },
  init() {
    // instantiate the express app
    this.app = express();
    this.app.disable('x-powered-by');

    // add cors-checking
    this.$log('using CORS with', this.cors);
    this.app.use((req, res, next) => this.checkCors(req, res, next));

    // add the typical body parsing
    this.app.use(bodyParser.json({ limit: this.bodyParserLimit }));
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.text({ limit: this.bodyParserLimit }));

    // add in our custom volante logging middleware
    this.app.use((req, res, next) => this.loggingMiddleware(req, res, next));
  },
  done() {
    if (this.server) {
      this.$debug('closing server');
      this.server.close();
    }
  },
  events: {
    'VolanteExpress.use'(...middleware) {
      this.$debug('adding middleware through event');
      this.app && this.app.use(...middleware);
    },
    'VolanteExpress.start'() {
      this.start();
    },
    'VolanteExpress.stop'() {
      this.stop();
    },
  },
  methods: {
    start() {
      this.$debug('starting express.js');

      // load user-specified middleware
      for (let mw of this.middleware) {
        this.app.use(mw);
      }
      this.$emit('VolanteExpress.pre-start', this.app);

      // add error handler middleware just before starting
      this.$debug('adding default error handler');
      this.app.use(this.errorMiddleware);

      if (this.https && this.key && this.cert) {
        let options = {
          key: this.key,
          cert: this.cert,
        };
        this.server = require('https').createServer(options, this.app);
      } else {
        this.server = require('http').createServer(this.app);
      }

      // handle express error
      this.server.on('error', this.handleExpressError);
      // handle express close
      this.server.on('close', this.handleExpressClose);

      // start express
      this.server.listen(this.port, this.bind, () => {
        this.$emit('VolanteExpress.listening', {
          bind: this.bind,
          port: this.port,
          server: this.server,
        });
        this.$ready(`listening in ${this.app.get('env')} mode for ${this.https?'HTTPS':'HTTP'} on ${this.bind}:${this.port}`);
      });
    },
    handleExpressError(err) {
      if (this.errorOnBindFail) {
        switch (err.code) {
          case 'EADDRINUSE':
            this.$error(`Port ${this.port} is already in use, is another instance running?`);
            break;
          default:
            this.$error('unable to open listen port', err);
        }
        this.$shutdown(); // system-wide dealbreaker
      } else {
        this.$warn(`Couldn't bind ${this.port}, set errorOnBindFail=true to exit here`);
      }
    },
    handleExpressClose() {
      this.$log(`closed ${this.https?'HTTPS':'HTTP'} server`);
    },
    //
    // middleware to check cors if it's set. passthrough otherwise
    //
    checkCors(req, res, next) {
      cors({ origin: this.cors, credentials: true })(req, res, next);
    },
    //
    // custom lightweight logging middleware which proxies to the built-in Volante .log() function
    //
    loggingMiddleware(req, res, next) {
      if (this.logging) {
        // starting datum
        let startAt = process.hrtime();

        // use on-finished module to log when HTTP request is finished
        onFinished(res, () => {
          let diff = process.hrtime(startAt);
          let ms = diff[0] * 1e3 + diff[1] * 1e-6;
          this.$log('express log', {
            method: req.method, // HTTP method
            // src IP address
            src: req.ip || req._remoteAddress || (req.connection && req.connection.remoteAddress),
            url: req.originalUrl || req.url, // url
            status: res.statusCode,
            ms // response time in milliseconds (don't try to round this, thanks JavaScript)
          });
        });
      }
      next();
    },
    //
    // add error handling middleware
    //
    errorMiddleware(err, req, res, next) {
      if (this.logging) {
        this.$error('express error', {
          method: req.method, // HTTP method
          // src IP address
          src: req.ip || req._remoteAddress || (req.connection && req.connection.remoteAddress),
          url: req.originalUrl || req.url, // url
          err
        });
      }
      if (err.statusCode) {
        res.status(err.statusCode).send();
      } else {
        res.status(500).send();
      }
    },
  },
};

if (require.main === module) {
  console.log('running test volante wheel');
  const volante = require('volante');

  let hub = new volante.Hub().debug();
  hub.attachAll().attachFromObject(module.exports);

  hub.emit('VolanteExpress.update', {
    bind: '0.0.0.0',
    port: 8080,
    middleware: [
      (req, res) => {
        res.send('<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:32px;font-family:sans-serif;font-weight:300;"><span>hello from volante-express</span><span>❤︎</span></div>');
      }
    ],
  });

  hub.emit('VolanteExpress.start');
}
