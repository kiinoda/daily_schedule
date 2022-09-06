'use strict';

const middy = require('@middy/core')
const ssm = require('@middy/ssm')

const AWS = require('aws-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const EVENT_RANGE = "A1:Q50"
const SHEET_FIRST_ROW = 3
const SHEET_END_ROW = 50
const SHEET_TIME_COLUMN = 8
const SHEET_EVENT_COLUMN = 9

AWS.config.update({ region: "eu-west-1" });

const sendEmail = async (events, sender, recipient) => {
  const message = events.join('\n');
  var params = {
    Destination: { ToAddresses: [recipient] },
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

const getEvents = async (sheet, currentDayNumber) => {
  const events = new Array();
  for (let r = SHEET_FIRST_ROW; r < SHEET_END_ROW; r++) {
    const evt = sheet.getCell(r, currentDayNumber).value;
    if (evt != null) {
      const time = sheet.getCell(r, SHEET_TIME_COLUMN).value || "----";
      const desc = sheet.getCell(r, SHEET_EVENT_COLUMN).value;
      events.push(`${evt} ${time} ${desc}`);
    }
  }
  if (events.length == 0) throw ('No events in the spreadsheet.');
  return events
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return [d.getUTCFullYear(), weekNo];
}

function getWeekDayNumberInRomanian(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const utcDay = d.getUTCDay()
  const ourDay = 0 == utcDay ? 7 : utcDay - 1 // our sheet uses Monday as the first day
  return ourDay
}

function getYear(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return d.getUTCFullYear();
}

const currentDate = new Date();
const [_, weekNo] = getWeekNumber(currentDate);
const currentDayNumber = getWeekDayNumberInRomanian(currentDate);
const currentYear = getYear(currentDate);

module.exports.run = middy(async (event, context) => {
  const doc = new GoogleSpreadsheet(context.config.spreadsheetId);
  doc.useApiKey(context.config.apiKey);
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[`${currentYear}W${weekNo}`];
  await sheet.loadCells('A1:Q50');
  const events = await getEvents(sheet, currentDayNumber);
  await sendEmail(events, context.config.sender, context.config.recipient);
}).use(ssm({
  cache: false,
  setToContext: true,
  fetchData: {
    config: `/personal/daily_schedule/config`
  }
}));
