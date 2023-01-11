function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  if (weekNo <= 9) { weekNo = `0${weekNo}` }
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

module.exports = {
  getWeekNumber,
  getWeekDayNumberInRomanian,
  getYear
}
