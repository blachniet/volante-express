const express = require('express');
const socketIo = require('socket.io');
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
    enableBodyParser: true,   // flag for switching body-parser on and off
    bodyParserLimit: '100mb', // body parser size limit
    enableSocketIo: true,     // enable socket.io
  },
  stats: {
    totalRequests: 0,         // total number of requests made
    numSocketIoClients: 0,    // current number of connected socket.io clients
  },
  init() {
    // instantiate the express app
    this.app = express();
    this.app.disable('x-powered-by');
    // update totalRequests stat every time we hit
    this.app.use((req, res, next) => {
      this.totalRequests++;
      next();
    });

    // add cors-checking
    this.$log('using CORS with', this.cors);
    this.app.use((req, res, next) => this.checkCors(req, res, next));

    // add the typical body parsing
    if (this.enableBodyParser) {
      this.app.use(express.json({ limit: this.bodyParserLimit }));
      this.app.use(express.urlencoded({ limit: this.bodyParserLimit, extended: true }));
      this.app.use(express.text({ limit: this.bodyParserLimit }));
    }

    // add in our custom volante logging middleware
    this.app.use((req, res, next) => this.loggingMiddleware(req, res, next));
  },
  done() {
    if (this.server) {
      this.$debug('closing server');
      this.server.close();
    }
  },
  data() {
    return {
      app: null, // the express app
      io: null,  // handle to socket.io
    };
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
      // emit a pre-start event for other spoke modules to register their
      // middleware
      this.$emit('VolanteExpress.pre-start', this.app);

      // emit a convenience event letting other modules
      // call the provided function to get a router that's
      // been attached to express and is ready to go
      this.$emit('VolanteExpress.router', () => {
        let r = express.Router();
        this.app.use(r);
        return r;
      });

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
        // start socket.io if enabled
        if (this.enableSocketIo) {
          this.startSocketIo();
        }
      });
    },
    //
    // start socket io server
    //
    startSocketIo() {
      this.$log('starting socket.io');
      this.io = socketIo(this.server, {
        path: '/socket.io',
        cors: {
          origin: this.cors,
        },
      });
      // maintain the client count stat
      this.io.on('connection', (socket) => {
        this.numSocketIoClients++;
        socket.on("disconnect", () => {
          this.numSocketIoClients--;
        });
      });
      // let clients access io to attach their own handlers
      this.$emit('VolanteExpress.socket.io', this.io);
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

        // use log when HTTP request is closed
        res.on('close', () => {
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
