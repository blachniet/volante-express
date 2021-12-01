/* global io */

console.log('setting up socket.io');
let socket = io('/');
socket.on('theTime', (d) => {
  document.getElementById('time').innerHTML = d;
});
