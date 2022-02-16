const express = require('express');
const path = require('path');

module.exports = {
  name: 'TestSpoke',
  events: {
    'VolanteExpress.pre-start'(app) {
      app.use(this.router);
      app.use(express.static(path.join(this.$hub.parentRoot, '/test')));
    },
    'VolanteExpress.ready'() {
      console.log('express called .$ready()');
    },
    'VolanteExpress.socket.io'(io) {
      io.on('connection', (client) => {
        setInterval(() => {
          client.emit('theTime', new Date().toISOString());
        }, 1000);
      });
    },
  },
  init() {
    this.router = express.Router();

    this.router.route('/test/json')
    .get((req, res) => {
      res.send('hello');
    })
    .post((req, res) => {
      this.$log(req.body);
      res.send(`you sent me ${JSON.stringify(req.body)}`);
    });
  },
  stats: {
  },
  data() {
    return {
      router: null,
    };
  },
  methods: {
  },
};

