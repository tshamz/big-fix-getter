const Q = require('q');
const moment = require('moment');
const Asana = require('asana');
const Table = require('cli-table');
const tabular = require('tabular-json');
const nodemailer = require('nodemailer');

const client = Asana.Client.create().useAccessToken('0/7de52d4b57a50d78f330438cb545f5b9');
const projectId = '238095597876701';

const startDate = moment().subtract(1, 'month').startOf('month');
const endDate = moment().subtract(1, 'month').endOf('month');

// const startDate = moment().subtract(0, 'month').startOf('month');
// const endDate = moment().subtract(0, 'month').endOf('month');

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
    let table = new Table({
      head: ['Individual', 'Bugs Fixed']
    });
    for (var key in individualTotals) {
      table.push([key, individualTotals[key]]);
    };
    console.log('\nBugs Fixed:');
    console.log(`${startDate} - ${endDate}`);
    console.log(table.toString());
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
    let table = new Table({
      head: ['Team', 'Bugs Released']
    });
    for (var key in teamTotals) {
      table.push([key, teamTotals[key]]);
    };
    console.log(table.toString());
  });
};

getMonthlyTotals();
teamTotals();
