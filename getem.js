const Q = require('q');
const moment = require('moment');
const Asana = require('asana');
const table = require('table');
const tabular = require('tabular-json');
const nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'tyler@bvaccel.com',
        pass: 'aiug8330'
    }
});

const client = Asana.Client.create().useAccessToken('0/7de52d4b57a50d78f330438cb545f5b9');
const projectId = '238095597876701';

const startDate = moment().subtract(1, 'week').startOf('day');
const endDate = moment();

const fixedParams = {
  'opt_expand': 'assignee,completed,name,projects',
  'limit': 100,
  'completed_since': startDate.format('YYYY-MM-DDTHH:mm:ss.sss')
};

const totalParams = {
  'opt_expand': 'created_at,projects',
  'limit': 100
};

const getTeamName = function (bug) {
  return bug.projects.map(function (project) {
    return project.team.name;
  }).filter(function (team) {
    return team !== 'INTERNAL';
  }).join(', ');
};

const individualTotals = function () {
  return client.tasks.findByProject(projectId, fixedParams, {}).then(function (collection) {
    let fixedBugs = collection.data.filter(function (bug) {
      return bug.completed;
    }).filter(function (bug) {
      return bug.assignee !== null;
    }).map(function (bug) {
      return {dev: bug.assignee.name, task: bug.name.replace(/.*(BUG|bug):/, '').trim()};
    });
    return fixedBugs;
  });
};

const getMonthlyTotals = function () {
  individualTotals().then(function (fixedBugs) {
    let individualTotals = fixedBugs.reduce(function (totals, bug) {
      let dev = bug.dev;
      (dev in totals) ? totals[dev]++ : totals[dev] = 1;
      return totals;
    }, {});
    data = [['Individual', 'Bugs Fixed']];
    for (var key in individualTotals) {
      data.push([key, individualTotals[key]]);
    };
    console.log('\nBugs Fixed:');
    console.log(`${startDate} - ${endDate}`);
  });
};

const teamTotals = function () {
  return client.tasks.findByProject(projectId, totalParams, {}).then(function (collection) {
    let teamTotals = collection.data.filter(function (bug) {
      let createdInRange = moment(bug.created_at).isBetween(startDate, endDate);
      let isSection = bug.name[bug.name.length - 1] === ':';  // asana section names always end in ':'
      return createdInRange && !isSection;
    }).filter(function (bug) {
      return getTeamName(bug) !== '';
    }).reduce(function (totals, bug) {
      let teamName = getTeamName(bug);
      (teamName in totals) ? totals[teamName]++ : totals[teamName] = 1;
      return totals;
    }, {});
    let data = [];
    for (var key in teamTotals) {
      data.push({team: key, 'bugs released': teamTotals[key]});
    };
    return data;
  });
};

const sendEmail = function() {
  return Q.spread([
    individualTotals(),
    teamTotals()
  ], function (solo, team) {
    let emailString = `<style>.table tbody tr:nth-child(odd){background-color: #eee;}</style>
<h2 style="font-size: 34px;">Howdy Y'all!! 🤠</h2>
This is yet another email in our ongoing series where we take a look back at the previous week and talk about bugs and all things bug related. Grab your flyswatters and come join me!
<br><br>
<h2 style="font-size: 34px;">🇺🇸Heroes in the War on Bugs 🇺🇸</h2>
In this section, we look back on the past week and celebrate the heroes who selflessly sacrificed themselves (and their billable time) in the pursuit of eradicating bugs from our sites and our communities.
<br><br>
${tabular.html(solo, {classes: {table:"table"}})}
<br><br>
<h2 style="font-size: 34px;">🐌 Bugs That Were CREATED. 🐛</h2>
In this section, we take a look at the total number of bugs that were released into the wild (a.k.a. created and then subsequently reported) this week and take a moment to reflect and draw whatever meaningful conclusions we can.
<br><br>
${tabular.html(team, {classes: {table:"table"}})}
<br><br>
---
<br><br>
Thanks for joining me for this installment in our series on bugs. Stay turned for next week when we talk about bugs...again!
<br><br>
Until then, stay sexy yall.
<br>
_t`;

    // setup email data with unicode symbols
    let mailOptions = {
        from: '"Pest Control" <tyler@bvaccel.com>', // sender address
        // to: 'tyler@theshamboras.com', // list of receivers
        to: 'delivery@bvaccel.com',
        subject: `🐝 BVA Weekly Bug Digest for ${moment().format('MMMM Do, YYYY')} 🐞`, // Subject line
        html: emailString // plain text body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log(error);
      }
      console.log('Message %s sent: %s', info.messageId, info.response);
    });

  });
};

module.exports = {
  sendEmail: sendEmail,
  getMonthlyTotals: getMonthlyTotals
};
