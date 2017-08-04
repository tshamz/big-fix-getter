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
      return {name: bug.assignee.name, bug: bug.name.replace(/.*(BUG|bug):/, '').trim()};
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
      data.push({name: key, 'bug': teamTotals[key]});
    };
    return data;
  });
};

const createTable = (data, heading) => {
  const tableStyle = 'style="border-collapse: collapse; border: solid #e0e0dc; border-width: 1px 0 0 1px; width: 100%;"'
  const headCellStyle = 'style="border: solid #e0e0dc; border-width: 0 1px 1px 0; padding: 6px 8px; text-align: left;background: rgba(212,221,228,.5);"'
  const cellStyle = 'style="border: solid #e0e0dc; border-width: 0 1px 1px 0; padding: 6px 8px; text-align: left;"'
  const tableHead = `<thead><tr><th ${headCellStyle}>${heading[0]}</th><th ${headCellStyle}>${heading[1]}</th></tr></thead>`;

  const tableBody = data.reduce((string, item) => {
    const name = `<td ${cellStyle}>${item.name}</td>`;
    const bug = `<td ${cellStyle}>${item.bug}</td>`;
    return `${string}<tr>${name}${bug}</tr>`;
  }, '');
  return `<table ${tableStyle}>${tableHead}<tbody>${tableBody}</tbody></table>`;
};

const sendEmail = function() {
  return Q.spread([
    individualTotals(),
    teamTotals()
  ], function (solo, team) {
    let emailString = `<style>.table tbody tr:nth-child(odd){background-color: #eee;}</style>
<div style="width: 600px; margin: 0 auto;">
<h2 style="font-size: 34px;">What up Y'all!</h2>
This is yet another email in our ongoing series where we take a look back at the previous week and talk about bugs and all things bug related. Grab your flyswatters and come join me!
<br><br>
<h2 style="font-size: 34px;"><u>🇺🇸 Heroes in the War on Bugs 🇺🇸</u></h2>
In this section, we look back on the past week and celebrate the heroes who selflessly sacrificed themselves (and their billable time) in the pursuit of eradicating bugs from our sites and our communities.
<br><br>
${createTable(solo, ['Developer', 'Bug'])}
<br><br>
<h2 style="font-size: 34px;"><u>Bugs That Were CREATED.</u></h2>
In this section, we take a look at the total number of bugs that were released into the wild (a.k.a. created and then subsequently reported) this week and take a moment to reflect and draw whatever meaningful conclusions we can.
<br><br>
${createTable(team, ['Team', 'Bugs Released'])}
<br><br>
---
<br><br>
Thanks for joining me for this installment in our series on bugs. Stay turned for next week when we talk about bugs...again!
<br><br>
Until then, stay sexy yall.
<br>
_t
</div>`;

    // setup email data with unicode symbols
    let mailOptions = {
      from: '"Pest Control" <tyler@bvaccel.com>', // sender address
      to: 'delivery@bvaccel.com',
      cc: 'tyler@bvaccel.com',
      subject: `🐝 BVA Weekly Bug Digest for ${moment().format('MMMM Do, YYYY')}`, // Subject line
      html: emailString
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
