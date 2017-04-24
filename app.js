const moment = require('moment');
const getem = require('./getem.js');

if (moment().day() === 3) {
  getem.sendEmail();
  console.log('it\'s Wednesday!');
} else {
  console.log('it\'s not Wednesday.');
};
