# Volante Spoke for Express.js

Provides a barebones express.js server for use in a Volante wheel.

## Features

- allows other Volante Spokes to self-register as middleware
- express logging emitted as Volante events

## Usage

```bash
npm install volante-express
```

Volante Spokes are automatically loaded and instanced if they are installed locally and `hub.attachAll()` is called.

## Options

Options are changed using the `volante-express.options` event with an options object:

```js
hub.emit('volante-express.options', {
  bind: '127.0.0.1',
  port: 3000,
  middleware: [
    // array of middleware, e.g.:
    require('compression')()
  ]
});
```

## Events

### Handled

- `volante-express.options` - main options call
  ```js
  {
    bind: String,
    port: Number,
    middleware: Array
  }
  ```
- `volante-express.use` - .use() call for middleware (enables self-registering volante middleware)
  ```js
  Object // middleware object used for .use() call
  ```
- `volante-express.start` - start the server
- `volante-express.stop` - stop the server

### Emitted

In addition to native Volante log events, this modules also emits:

- `volante-express.listening'
  ```js
  {
    bind: String,
    port: Number
  }
  ```


## Self-registering Middleware

This module enables self-registering express middleware wrapped as Volante Spoke modules. Note that this will require an initial `volante-express.options` event to kick off the self-registering process.

```js
this.hub.on('volante-express.options', () => {
  this.hub.emit('volante-express.use', this);
});
```

## License

ISC