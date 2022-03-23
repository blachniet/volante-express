const express = require('express');
const path = require('path');

module.exports = {
  name: 'TestSpoke',
  events: {
    // example for middleware
    'VolanteExpress.pre-start'(app) {
      app.use(express.text({
        limit: '10mb',
        type: 'text/xml'
      }));
      app.use(express.static(path.join(this.$hub.parentRoot, '/test')));
    },
    'VolanteExpress.router'(router) {
      router().route('/test/json')
      .get((req, res) => {
        res.send('hello');
      })
      .post((req, res) => {
        this.$log(req.body);
        res.send(`you sent me ${JSON.stringify(req.body)}`);
      });
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

