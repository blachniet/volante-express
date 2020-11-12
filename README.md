# Volante Spoke for Express.js

Provides a barebones express.js server for use in a Volante wheel.

## Features

- allows other Volante Spokes to register as Express middleware
- Express logging emitted as Volante events

## Usage

```bash
npm install volante-express
```

Volante Spokes are automatically loaded and instanced if they are installed locally and `hub.attachAll()` is called.

## Props

Options are changed using the `VolanteExpress.update` event with an object:

```js
hub.emit('VolanteExpress.update', {
  bind: '127.0.0.1',               // bind address
  port: 3000,                      // server port
  https: false,                    // enable https mode
  cert: null,                      // tls certificate
  key: null,                       // tls private key
  logging: true,                   // emit express log as Volante events
  cors: []                         // CORS entries, adding to array enables cors
  middleware: [                    // express middleware
    // array of express middleware, e.g.:
    require('compression')()
  ]
});
```

## Events

### Handled

- `VolanteExpress.use` - .use() call for middleware (enables self-registering volante middleware)
  ```js
  Object // middleware object used for .use() call
  ```
- `VolanteExpress.crud` - enable crud bridge
  ```js
  {
    name: String, // name/collection/table/directory used for datasource
    path: String, // http path to apply CRUD (e.g. .get('/'), etc)
  }
  ```
- `VolanteExpress.start` - start the server (call this LAST, after all middleware has been added)
- `VolanteExpress.stop` - stop the server

### Emitted

In addition to native Volante log events, this modules also emits:

- `VolanteExpress.listening'
  ```js
  {
    bind: String,
    port: Number
  }
  ```

### Logs

Express.js HTTP requests are logged with the following structure:

```js
{
  method: String,
  src: String,
  url: String,
  status: Number,
  ms: Number
}
```

## Self-registering Middleware

This module enables self-registering express middleware wrapped as Volante Spoke modules. Note that this will require an initial `VolanteExpress.update` event to kick off the self-registering process.

```js
this.hub.on('VolanteExpress.update', () => {
  this.hub.emit('VolanteExpress.use', this);
});
```

## License

ISC