const volante = require('volante');
let hub = new volante.Hub().loadConfig('example/config.json');
hub.emit('VolanteExpress.start');