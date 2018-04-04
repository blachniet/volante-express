const express = require('express');
const onFinished = require('on-finished');

//
// Volante module providing an express.js server
//
module.exports = {
	name: 'VolanteExpress',
	events: {
    'VolanteExpress.use'(middleware) {
      this.app && this.app.use(middleware);
    },
    'VolanteExpress.start'() {
			this.start()
		},
    'VolanteExpress.stop'() {
			this.stop()
		},
  },
	props: {
    bind: '127.0.0.1',
    port: 3000,
    logging: true,
    middleware: [],
  },
	updated() {
	},
	methods: {
		start() {
		  this.debug('starting express.js');
		  // instantiate the express app
		  this.app = express();
		  this.app.disable('x-powered-by');

		  // logging middleware
		  this.app.use((req, res, next) => this.loggingMiddleware(req, res, next));

		  // load user-specified middleware
		  for (let mw of this.middleware) {
		    this.app.use(mw);
		  }
			
		  this.server = require('http').Server(this.app);

		  this.server.on('error', (err) => {
		    switch (err.code) {
		      case 'EADDRINUSE':
		        this.error(`Port ${this.port} is already in use, is another instance running?`);
		        break;
		      default:
		        this.error(`unable to open listen port: ${err}`);
		    }
		    this.shutdown(); // dealbreaker
		  });

		  this.server.listen(this.port, this.bind, () => {
		    this.$emit('VolanteExpress.listening', {
		      bind: this.bind,
		      port: this.port
		    });
		    this.log(`listening in ${this.app.get('env')} mode for HTTP on ${this.bind}:${this.port}`);
		  });
		},
		//
		// lightweight-logging middleware which calls the built-in Volante .log() function
		//
		loggingMiddleware(req, res, next) {
		  if (this.logging) {
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
	},
}
