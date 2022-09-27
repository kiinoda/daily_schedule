'use strict';

const middy = require('@middy/core')
const ssm = require('@middy/ssm')

const AWS = require('aws-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const EVENT_RANGE = "A1:Q50"
const EVENTS_SHEET_FIRST_ROW = 3
const EVENTS_SHEET_END_ROW = 50
const EVENTS_SHEET_TIME_COLUMN = 8
const EVENTS_SHEET_EVENT_COLUMN = 9
const EVENTS_SHEET_MIGRATE_COLUMN = 16
const EVENTS_EMPTY_TIME_PLACEHOLDER = "----"

const TASKS_RANGE = "A10:C100"
const TASKS_SHEET_FIRST_ROW = 10
const TASKS_SHEET_END_ROW = 100
const TASKS_SHEET_TASK_COLUMN = 0
const TASKS_SHEET_TAG_COLUMN = 2
const TASKS_SHEET_EASY_SIGNIFIER = 2

AWS.config.update({ region: "eu-west-1" });

const sendEmail = async (events, easy_tasks, sender, recipient) => {
  const textMessage = events.join('\n') + '\n' + easy_tasks.join('\n');
  const htmlMessage = `<html><pre>${events.join('\n')}\n\n${easy_tasks.join('\n')}</pre></html>`;
  var params = {
    Destination: { ToAddresses: [recipient] },
    Message: {
      Body: {
        Text: { Data: textMessage },
        Html: { Data: htmlMessage }
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
  events.push("Remember: Actual life happens outside the computer.");
  events.push("");
  for (let i = EVENTS_SHEET_FIRST_ROW; i < EVENTS_SHEET_END_ROW; i++) {
    const eventSignifier = sheet.getCell(i, currentDayNumber).value;
    const taggedForMigration = sheet.getCell(i, EVENTS_SHEET_MIGRATE_COLUMN).value;
    if (null != eventSignifier && null == taggedForMigration) {
      const time = sheet.getCell(i, EVENTS_SHEET_TIME_COLUMN).value || EVENTS_EMPTY_TIME_PLACEHOLDER;
      const description = sheet.getCell(i, EVENTS_SHEET_EVENT_COLUMN).value;
      events.push(`${eventSignifier} ${time} ${description}`);
    }
  }
  return events;
}

const getEasyTasks = async (sheet) => {
  const tasks = new Array();
  for (let i = TASKS_SHEET_FIRST_ROW; i < TASKS_SHEET_END_ROW; i++) {
    const taskSignifier = sheet.getCell(i, TASKS_SHEET_TAG_COLUMN).value;
    if (TASKS_SHEET_EASY_SIGNIFIER == taskSignifier) {
      const description = sheet.getCell(i, TASKS_SHEET_TASK_COLUMN).value;
      tasks.push(`* ${description}`);
    }
  }
  if (tasks.length > 0) {
    tasks.unshift("Easy tasks you could take care of:")
  } else {
    tasks.push("Looks like there are no easy tasks queued up.")
  }

  return tasks;
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
  const ourDay = 0 == utcDay ? 6 : utcDay - 1 // our sheet uses Monday as the first day
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
  const events_sheet = doc.sheetsByTitle[`${currentYear}W${weekNo}`];
  await events_sheet.loadCells(EVENT_RANGE);
  const events = await getEvents(events_sheet, currentDayNumber);
  const tasks_sheet = doc.sheetsByTitle["NorthStar"]
  await tasks_sheet.loadCells(TASKS_RANGE);
  const easy_tasks = await getEasyTasks(tasks_sheet);
  await sendEmail(events, easy_tasks, context.config.sender, context.config.recipient);
}).use(ssm({
  cache: false,
  setToContext: true,
  fetchData: {
    config: `/personal/daily_schedule/config`
  }
}));
