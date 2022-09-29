'use strict';

const middy = require('@middy/core')
const ssm = require('@middy/ssm')

const AWS = require('aws-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const EVENT_RANGE = "A1:Q50"
const EVENTS_SHEET_FIRST_ROW = 3
const EVENTS_SHEET_END_ROW = 49
const EVENTS_SHEET_TIME_COLUMN = 8
const EVENTS_SHEET_EVENT_COLUMN = 9
const EVENTS_SHEET_MIGRATE_COLUMN = 16
const EVENTS_EMPTY_TIME_PLACEHOLDER = "----"

const TASKS_SHEET_NAME = "Tasks"
const TASKS_RANGE = "A10:C100"
const TASKS_SHEET_FIRST_ROW = 9
const TASKS_SHEET_END_ROW = 99
const TASKS_SHEET_TASK_COLUMN = 0
const TASKS_SHEET_TAG_COLUMN = 2
const TASKS_SHEET_EASY_SIGNIFIER = 2
const TASKS_SHEET_IMPORTANT_SIGNIFIER = "*"

const DEV_TASKS_SHEET_NAME = "NorthStar"
const DEV_TASKS_RANGE = "A2:A50"
const DEV_TASKS_SHEET_FIRST_ROW = 1
const DEV_TASKS_SHEET_LAST_ROW = 49
const DEV_TASKS_SHEET_TASK_COLUMN = 0

AWS.config.update({ region: "eu-west-1" });

const sendEmail = async (events, houseTasks, devTasks, sender, recipient) => {
  const textMessage = events.join('\n') + '\n\n\n' + houseTasks.join('\n') + '\n\n\n' + devTasks.join('\n');
  const htmlMessage = `<html><pre>${events.join('\n')}\n\n\n${houseTasks.join('\n')}\n\n\n${devTasks.join('\n')}</pre></html>`;
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
  const thoughts = new Array(
    "If you can't delegate, take care of the urgent items first!",
    "Are you doing enough to maintain your physical and mental health?",
    "Hey, actual life happens outside the computer."
  )
  const events = new Array();
  const randomThoughtID = Math.floor(Math.random() * thoughts.length);
  events.push(thoughts[randomThoughtID]);
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

const getRandomElements = (array, count) => {
  const randomIndexes = (maximum, howMany) => {
    const arr = new Array();

    // populate with values
    for (let i = 0; i < maximum; i++) {
      arr[i] = i;
    }

    // extract our random values
    let processableLength = maximum-1;
    while (maximum-processableLength < howMany) {
      const randomNumber = Math.ceil(Math.random() * processableLength);
      [arr[processableLength],arr[randomNumber]] = [arr[randomNumber], arr[processableLength]];
      processableLength--;
    }
    return arr.slice(maximum-howMany);
  }

  const elements = new Array();
  for (const value of randomIndexes(array.length, count)) {
    elements.push(array[value]);
  }
  return elements;
}

const getHouseTasks = async (sheet) => {
  const easyTasks = new Array();
  const topTasks = new Array();
  const someEasyTasks = new Array();
  for (let i = TASKS_SHEET_FIRST_ROW; i < TASKS_SHEET_END_ROW; i++) {
    const taskSignifier = sheet.getCell(i, TASKS_SHEET_TAG_COLUMN).value;
    if (TASKS_SHEET_IMPORTANT_SIGNIFIER == taskSignifier) {
      const description = sheet.getCell(i, TASKS_SHEET_TASK_COLUMN).value;
      topTasks.push(`- ${description}`);
    }
    if (TASKS_SHEET_EASY_SIGNIFIER == taskSignifier) {
      const description = sheet.getCell(i, TASKS_SHEET_TASK_COLUMN).value;
      easyTasks.push(`- ${description}`);
    }
  }
  if (topTasks.length > 0) {
    topTasks.unshift("Important tasks you must take care of:\n");
  } else {
    topTasks.push("There are no important tasks queued up.\n");
  }
  if (easyTasks.length > 0) {
    someEasyTasks.push("Easy tasks you could take care of:\n");
    someEasyTasks.push(...getRandomElements(easyTasks, 3));
  } else {
    someEasyTasks.push("Looks like there are no easy tasks queued up.\n");
  }
  const tasks = topTasks.concat(["\n"].concat(someEasyTasks));
  return tasks;
}

const getDevTasks = async (sheet) => {
  const tasks = new Array();
  for (let i = DEV_TASKS_SHEET_FIRST_ROW; i < DEV_TASKS_SHEET_LAST_ROW; i++) {
    const description = sheet.getCell(i, DEV_TASKS_SHEET_TASK_COLUMN).value;
    if (null != description) {
      tasks.push(`- ${description}`);
    }
  }
  const firstThreeTasks = tasks.slice(0, 3)
  if (firstThreeTasks.length > 0) {
    firstThreeTasks.unshift("Dev tasks you can progress on:\n");
  } else {
    firstThreeTasks.push("Looks like there are no dev tasks queued up.");
  }
  return firstThreeTasks;
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
  const eventsSheet = doc.sheetsByTitle[`${currentYear}W${weekNo}`];
  await eventsSheet.loadCells(EVENT_RANGE);
  const events = await getEvents(eventsSheet, currentDayNumber);
  const tasksSheet = doc.sheetsByTitle[TASKS_SHEET_NAME];
  await tasksSheet.loadCells(TASKS_RANGE);
  const houseTasks = await getHouseTasks(tasksSheet);
  const devTasksSheet = doc.sheetsByTitle[DEV_TASKS_SHEET_NAME];
  await devTasksSheet.loadCells(DEV_TASKS_RANGE);
  const devTasks = await getDevTasks(devTasksSheet);

  await sendEmail(events, houseTasks, devTasks, context.config.sender, context.config.recipient);
}).use(ssm({
  cache: false,
  setToContext: true,
  fetchData: {
    config: `/personal/daily_schedule/config`
  }
}));
