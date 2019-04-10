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

		// use json body parsing
	  this.app.use(bodyParser.json());

	  // add in our custom volante logging middleware
	  this.app.use((req, res, next) => this.loggingMiddleware(req, res, next));
	},
	events: {
    'VolanteExpress.use'(middleware) {
      this.app && this.app.use(middleware);
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
    logging: true,
    enableAdminGui: true,
    adminGuiPort: 4000,
    cors: [],
    middleware: [],
  },
	methods: {
		start() {
		  this.$debug('starting express.js');

		  // load user-specified middleware
		  for (let mw of this.middleware) {
		    this.app.use(mw);
		  }

		  if (this.cors.length > 0) {
		  	// use cors
		  	this.$log(`using CORS with ${JSON.stringify(this.cors)}`);
		  	this.app.use(cors({
		  		origin: this.cors,
				}));
		  }

		  this.server = require('http').Server(this.app);

		  this.server.on('error', (err) => {
		    switch (err.code) {
		      case 'EADDRINUSE':
		        this.$error(`Port ${this.port} is already in use, is another instance running?`);
		        break;
		      default:
		        this.$error(`unable to open listen port: ${err}`);
		    }
		    this.$shutdown(); // system-wide dealbreaker
		  });

			// start
		  this.server.listen(this.port, this.bind, () => {
		    this.$emit('VolanteExpress.listening', {
		      bind: this.bind,
		      port: this.port
		    });
		    this.$log(`listening in ${this.app.get('env')} mode for HTTP on ${this.bind}:${this.port}`);
		  });
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
		        ms // response time in milliseconds
		      });
		    });
		  }
		  next();
		},
		registerCrud(obj) {
			this.$debug('setting up CRUD bridge between express.js and Volante');
			if (obj.name && obj.path) {
				// create
				this.app.post(obj.path, (req, res) => {
					if (req.body) {
						this.$emit(`volante.create`, obj.name, req.body);
					}
					res.send('ok');
				});
				// read
				this.app.get(obj.path, (req, res) => {
					this.$emit(`volante.read`, obj.name, {}, (docs) => {
						res.send(docs);
					});
				});
				// read by id
				this.app.get(`${obj.path}/:id`, (req, res) => {
					this.$emit(`volante.read`, obj.name, req.params.id, (docs) => {
						res.send(docs);
					});
				});
				// update
				this.app.put(`${obj.path}/:id`, (req, res) => {
					this.$emit(`volante.update`, obj.name, req.params.id, req.body);
					res.send('ok');
				});
				// delete
				this.app.delete(`${obj.path}/:id`, (req, res) => {
					this.$emit(`volante.delete`, obj.name, req.params.id);
					res.send('ok');
				});
	    } else {
	    	this.warn('registerCrud called without required parameters');
	    }
		},
	},
};
