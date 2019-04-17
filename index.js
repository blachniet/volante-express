const express = require('express');
const onFinished = require('on-finished');
const bodyParser = require('body-parser');
const cors = require('cors');

//
// Volante module providing an express.js server
//
module.exports = {
	name: 'VolanteExpress',
	init() {
	  // instantiate the express app
	  this.app = express();
	  this.app.disable('x-powered-by');

		// add cors-checking
		this.app.use((req, res, next) => this.checkCors(req, res, next));

		// use json body parsing
	  this.app.use(bodyParser.json());

	  // add in our custom volante logging middleware
	  this.app.use((req, res, next) => this.loggingMiddleware(req, res, next));
	},
	done() {
		this.$debug('closing server');
		this.server.close();
	},
	events: {
    'VolanteExpress.use'(...middleware) {
    	this.$debug('adding middleware through event');
      this.app && this.app.use(...middleware);
    },
    'VolanteExpress.crud'(obj) {
			this.registerCrud(obj);
    },
    'VolanteExpress.start'() {
			this.start();
		},
    'VolanteExpress.stop'() {
			this.stop();
		},
  },
	props: {
    bind: '127.0.0.1',
    port: 3000,
    https: false,
    key: null,
    cert: null,
    logging: true,
    cors: [],
    middleware: [],
  },
  updated() {
  	if (this.cors.length > 0) {
  		this.$log('using CORS with', this.cors);
  	}
  },
	methods: {
		start() {
		  this.$debug('starting express.js');

		  // load user-specified middleware
		  for (let mw of this.middleware) {
		    this.app.use(mw);
		  }

			if (this.https && this.key && this.cert) {
				let options = {
					key: this.key,
					cert: this.cert,
				};
				this.server = require('https').createServer(options, this.app);
			} else {
			  this.server = require('http').createServer(this.app);
			}

		  this.server.on('error', (err) => {
		    switch (err.code) {
		      case 'EADDRINUSE':
		        this.$error(`Port ${this.port} is already in use, is another instance running?`);
		        break;
		      default:
		        this.$error('unable to open listen port', err);
		    }
		    this.$shutdown(); // system-wide dealbreaker
		  });

		  this.server.on('close', () => {
		  	this.$log(`closed ${this.https?'HTTPS':'HTTP'} server`);
		  });

			// start
		  this.server.listen(this.port, this.bind, () => {
		    this.$emit('VolanteExpress.listening', {
		      bind: this.bind,
		      port: this.port
		    });
		    this.$log(`listening in ${this.app.get('env')} mode for ${this.https?'HTTPS':'HTTP'} on ${this.bind}:${this.port}`);
		  });
		},
		//
		// middleware to check cors if it's set. passthrough otherwise
		checkCors(req, res, next) {
			if (this.cors.length > 0) {
				cors({ origin: this.cors })(req, res, next);
			} else {
				next();
			}
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
		      this.$log({
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
		// add routes for a generic CRUD bridge between express and volante
		//
		registerCrud(obj) {
			this.$debug('setting up simple CRUD bridge between express.js and Volante');
			this.$debug(`CRUD operations on ${obj.path} will be mapped to ${obj.name}`);
			if (obj.name && obj.path) {
				// create
				this.app.post(obj.path, (req, res) => {
					if (req.body) {
						this.$emit(`volante.create`, obj.name, req.body, (err, result) => {
							if (err) return res.status(500).send(err);
							res.send(result);
						});
					}
				});
				// read all
				this.app.get(obj.path, (req, res) => {
					this.$emit(`volante.read`, obj.name, {}, (err, docs) => {
						if (err) return res.status(500).send(err);
						res.send(docs);
					});
				});
				// query (pass body through as query)
				this.app.post(`${obj.path}/query`, (req, res) => {
					this.$emit(`volante.read`, obj.name, req.body, (err, docs) => {
						if (err) return res.status(500).send(err);
						res.send(docs);
					});
				});
				// read by id
				this.app.get(`${obj.path}/:id`, (req, res) => {
					this.$emit(`volante.read`, obj.name, req.params.id, (err, docs) => {
						if (err) return res.status(500).send(err);
						res.send(docs);
					});
				});
				// update
				this.app.put(`${obj.path}/:id`, (req, res) => {
					this.$emit(`volante.update`, obj.name, req.params.id, req.body, (err, result) => {
						if (err) return res.status(500).send(err);
						res.send(result);
					});
				});
				// delete
				this.app.delete(`${obj.path}/:id`, (req, res) => {
					this.$emit(`volante.delete`, obj.name, req.params.id, (err, result) => {
						if (err) return res.status(500).send(err);
						res.send(result);
					});
				});
	    } else {
	    	this.warn('registerCrud called without required parameters');
	    }
		},
	},
};
