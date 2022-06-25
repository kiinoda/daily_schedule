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
  } catch {
    console.log('Failed sending email');
    console.log(error);
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

const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentDayName = days[currentDate.getDay()];
const firstDayOfYear = new Date(currentYear, 0);
const numberOfDays = Math.floor((currentDate - firstDayOfYear) / (24 * 60 * 60 * 1000));
const weekNo = Math.ceil(( currentDate.getDay() + 1 + numberOfDays) / 7);

module.exports.run = middy(async (event, context) => {
  const parser = new PublicGoogleSheetsParser(context.config.spreadsheetId, `${currentYear}W${weekNo}`);
  const items = await parser.parse();
  const events = await getEvents(items);
  sendEmail(events, context.config.sender, context.config.recipient);
}).use(ssm({
  cache: false,
  setToContext: true,
  fetchData: {
    config: `/personal/daily_schedule/config`
  }
}));
