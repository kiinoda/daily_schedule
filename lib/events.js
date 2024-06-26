const { GoogleSpreadsheet } = require('google-spreadsheet');
const { getWeekDayNumberInRomanian } = require('./date.js');
const moment = require('moment-timezone');

const EVENT_RANGE = "A1:Q25"
const EVENTS_SHEET_FIRST_ROW = 3
const EVENTS_SHEET_END_ROW = 24
const EVENTS_SHEET_TIME_COLUMN = 8
const EVENTS_SHEET_EVENT_COLUMN = 9
const EVENTS_SHEET_MIGRATE_COLUMN = 16
const EVENTS_EMPTY_TIME_PLACEHOLDER = "----"

const currentDate = new Date();
const currentDayNumber = getWeekDayNumberInRomanian(currentDate);

const getRandomAdvice = () => {
  const advices = [
    "What do I fear most today?",
    "If I can't delegate, I should take care of the urgent items first.",
    "Am I doing enough to maintain my physical and mental health?",
    "Actual life happens outside the computer.",
    "What can I defer to the future?",
    "If I can't avoid it, I may as well get good at it."
  ]
  const randomAdviceID = Math.floor(Math.random() * advices.length);
  const randomAdvice = advices[randomAdviceID];
  return randomAdvice
}

const getEventsSheetHandle = async (sheetId, apiKey) => {
  const doc = new GoogleSpreadsheet(sheetId);
  doc.useApiKey(apiKey);
  await doc.loadInfo();
  const eventsSheet = doc.sheetsByTitle["Weekly"];
  return eventsSheet;
}

const getEventsForToday = async (sheetId, apiKey) => {
  const events = [];

  eventsSheet = await getEventsSheetHandle(sheetId, apiKey);
  await eventsSheet.loadCells(EVENT_RANGE);

  try {
    for (let i = EVENTS_SHEET_FIRST_ROW; i < EVENTS_SHEET_END_ROW; i++) {
      const eventSignifier = await eventsSheet.getCell(i, currentDayNumber).value;
      const taggedForMigration = await eventsSheet.getCell(i, EVENTS_SHEET_MIGRATE_COLUMN).value;
      if (null != eventSignifier && null == taggedForMigration) {
        const time = await eventsSheet.getCell(i, EVENTS_SHEET_TIME_COLUMN).value || EVENTS_EMPTY_TIME_PLACEHOLDER;
        const description = await eventsSheet.getCell(i, EVENTS_SHEET_EVENT_COLUMN).value;
        events.push(`${eventSignifier} ${time} ${description}`);
      }
    }
  } catch {
    events.push('ERROR: Weekly data could not be loaded.');
  }
  
  return events;
}

const getEvents = async (sheetId, apiKey) => {
  const events = [];

  events.push(getRandomAdvice());
  events.push("");
  const currentEvents = await getEventsForToday(sheetId, apiKey);
  currentEvents.forEach(element => events.push(element));

  return events;
}

const getAlarms = async (sheetId, apiKey) => {
  const alarms = [];

  eventsSheet = await getEventsSheetHandle(sheetId, apiKey);
  await eventsSheet.loadCells(EVENT_RANGE);

  try {
    for (let i = EVENTS_SHEET_FIRST_ROW; i < EVENTS_SHEET_END_ROW; i++) {
      const eventSignifier = await eventsSheet.getCell(i, currentDayNumber).value;
      const taggedForMigration = await eventsSheet.getCell(i, EVENTS_SHEET_MIGRATE_COLUMN).value;
      if (null != eventSignifier && null == taggedForMigration) {
        const time = await eventsSheet.getCell(i, EVENTS_SHEET_TIME_COLUMN).value;
        if (null != time) {
          const start = moment.tz(time.toString(), "HH:mm", "Europe/Bucharest");
          const current = moment();
          const difference = Math.floor(moment.duration(current-start).asMinutes());
          if (-2 <= difference && difference <= 2) {
            const description = await eventsSheet.getCell(i, EVENTS_SHEET_EVENT_COLUMN).value;
            console.log(`Sending alert for ${time} ${description}`);
            alarms.push(`${time} * ${description}`);
          }
        }
      }
    }
  } catch {
    throw("Could not extract alarms for time interval.");
  }
 
  return alarms;
}

module.exports = {
  getEvents,
  getAlarms,
};
