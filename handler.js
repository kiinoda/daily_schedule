'use strict';

const middy = require('@middy/core')
const ssm = require('@middy/ssm')

const AWS = require('aws-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const {getSESEmailParameters, sendSESEmail} = require('./lib/aws_email.js');

const AWS_REGION = "eu-west-1"

const EVENT_RANGE = "A1:Q50"
const EVENTS_SHEET_FIRST_ROW = 3
const EVENTS_SHEET_END_ROW = 49
const EVENTS_SHEET_TIME_COLUMN = 8
const EVENTS_SHEET_EVENT_COLUMN = 9
const EVENTS_SHEET_MIGRATE_COLUMN = 16
const EVENTS_EMPTY_TIME_PLACEHOLDER = "----"

AWS.config.update({ region: AWS_REGION });

const getEvents = async (sheet, currentDayNumber) => {
  const thoughts = [
    "Hey, what do you fear most today?",
    "If you can't delegate, take care of the urgent items first!",
    "Are you doing enough to maintain your physical and mental health?",
    "Hey, actual life happens outside the computer."
  ]
  const events = [];
  const randomThoughtID = Math.floor(Math.random() * thoughts.length);
  events.push(thoughts[randomThoughtID]);
  events.push("");
  for (let i = EVENTS_SHEET_FIRST_ROW; i < EVENTS_SHEET_END_ROW; i++) {
    const eventSignifier = await sheet.getCell(i, currentDayNumber).value;
    const taggedForMigration = await sheet.getCell(i, EVENTS_SHEET_MIGRATE_COLUMN).value;
    if (null != eventSignifier && null == taggedForMigration) {
      const time = await sheet.getCell(i, EVENTS_SHEET_TIME_COLUMN).value || EVENTS_EMPTY_TIME_PLACEHOLDER;
      const description = await sheet.getCell(i, EVENTS_SHEET_EVENT_COLUMN).value;
      events.push(`${eventSignifier} ${time} ${description}`);
    }
  }
  return events;
}

const currentDate = new Date();
const [_, weekNo] = getWeekNumber(currentDate);
const currentDayNumber = getWeekDayNumberInRomanian(currentDate);
const currentYear = getYear(currentDate);

module.exports.run = middy(async (_event, context) => {
  const doc = new GoogleSpreadsheet(context.config.spreadsheetId);
  doc.useApiKey(context.config.apiKey);
  await doc.loadInfo();
  let events = [];

  try {
    const eventsSheet = doc.sheetsByTitle[`${currentYear}W${weekNo}`];
    await eventsSheet.loadCells(EVENT_RANGE);
    events = await getEvents(eventsSheet, currentDayNumber);
  } catch {
    events = ['ERROR: Weekly data could not be loaded.'];
  }

  const emailParameters = getSESEmailParameters(events, context.config.sender, context.config.recipient);
  await sendSESEmail(emailParameters, AWS_REGION);
}).use(ssm({
  cache: false,
  setToContext: true,
  fetchData: {
    config: `/personal/daily_schedule/config`
  }
}));
