'use strict';

const middy = require('@middy/core')
const ssm = require('@middy/ssm')

const AWS = require('aws-sdk');
const PublicGoogleSheetsParser = require('public-google-sheets-parser');

AWS.config.update({ region: "eu-west-1" });

const sendEmail = async (events, sender, recipient) => {
  const message = events.join('\n');
  var params = {
    Destination: { ToAddresses: [ recipient ] },
    Message: {
      Body: {
        Text: { Data: message }
      },
      Subject: { Data: 'Today\'s Schedule' }
    },
    Source: `Daily Schedule Bot <${sender}>`
  };
  const ses = new AWS.SES({ apiVersion: '2010-12-01' });
  try {
    const status = await ses.sendEmail(params).promise();
    console.log('Successfully sent email');
    console.log(status);
  } catch (err) {
    console.log('Failed sending email');
    console.log(err);
  }
  
}

const getEvents = async (spreadsheet_items) => {
  const events = new Array();
  spreadsheet_items.slice(1).forEach(row => {
    const keys = Object.keys(row);
    for (const key of keys) {
      if (row[key] && key.includes(currentDayName)) {
        const time = row['AWS '] ? row['AWS '] : '----';
        events.push(`${time} ${row[key]} ${row['']}`);
      }
    }
  })
  if (events.length == 0) throw ('No events in the spreadsheet.');
  return events
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return [d.getUTCFullYear(), weekNo];
}

function getWeekDay(d) {
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return days[d.getUTCDay()]
}

function getYear(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return d.getUTCFullYear();
}

const currentDate = new Date();
const [_, weekNo] = getWeekNumber(currentDate);
const currentDayName = getWeekDay(currentDate);
const currentYear = getYear(currentDate);

module.exports.run = middy(async (event, context) => {
  const parser = new PublicGoogleSheetsParser(context.config.spreadsheetId, `${currentYear}W${weekNo}`);
  const items = await parser.parse();
  const events = await getEvents(items);
  await sendEmail(events, context.config.sender, context.config.recipient);
}).use(ssm({
  cache: false,
  setToContext: true,
  fetchData: {
    config: `/personal/daily_schedule/config`
  }
}));
