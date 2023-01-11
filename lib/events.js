const { GoogleSpreadsheet } = require('google-spreadsheet');
const {getWeekNumber, getWeekDayNumberInRomanian, getYear} = require('./date.js');

const EVENT_RANGE = "A1:Q50"
const EVENTS_SHEET_FIRST_ROW = 3
const EVENTS_SHEET_END_ROW = 49
const EVENTS_SHEET_TIME_COLUMN = 8
const EVENTS_SHEET_EVENT_COLUMN = 9
const EVENTS_SHEET_MIGRATE_COLUMN = 16
const EVENTS_EMPTY_TIME_PLACEHOLDER = "----"

const currentDate = new Date();
const [_, weekNo] = getWeekNumber(currentDate);
const currentDayNumber = getWeekDayNumberInRomanian(currentDate);
const currentYear = getYear(currentDate);

const getRandomAdvice = () => {
  const advices = [
    "Hey, what do you fear most today?",
    "If you can't delegate, take care of the urgent items first!",
    "Are you doing enough to maintain your physical and mental health?",
    "Hey, actual life happens outside the computer."
  ]
  const randomAdviceID = Math.floor(Math.random() * advices.length);
  const randomAdvice = advices[randomAdviceID];
  return randomAdvice
}

const getEventsForToday = async (sheetId, apiKey) => {
  const events = [];

  const doc = new GoogleSpreadsheet(sheetId);
  doc.useApiKey(apiKey);
  await doc.loadInfo();
  const eventsSheet = doc.sheetsByTitle[`${currentYear}W${weekNo}`];
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

module.exports = {
  getEvents,
};