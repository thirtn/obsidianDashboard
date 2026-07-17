export function getLunarInfo(date: Date): {
  ganzhiYear: string;
  zodiac: string;
  lunarMonth: string;
  lunarDay: string;
  shichen: string;
} {
  const ganzhi = getGanzhiYear(date);
  const zodiac = getZodiac(date);
  const [lm, ld] = getLunarDate(date);
  return {
    ganzhiYear: ganzhi,
    zodiac,
    lunarMonth: lm,
    lunarDay: ld,
    shichen: getShichen(date.getHours()),
  };
}

const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ZODIAC = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

/** Ganzhi year for a given date. Ganzhi changes at 立春 (~Feb 4), but here we use lunar new year cutoff
 *  for simplicity — for anything outside Jan/early Feb this is identical. */
function getGanzhiYear(date: Date): string {
  const year = getLunarYear(date);
  const idx = (year - 4) % 60;
  const stem = HEAVENLY_STEMS[idx % 10];
  const branch = EARTHLY_BRANCHES[idx % 12];
  return stem + branch;
}

function getZodiac(date: Date): string {
  const year = getLunarYear(date);
  return ZODIAC[(year - 4) % 12];
}

function getShichen(hour: number): string {
  const idx = Math.floor(((hour + 1) % 24) / 2);
  return EARTHLY_BRANCHES[idx] + "时";
}

const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
function lunarDayCn(day: number): string {
  if (day === 10) return "初十";
  if (day === 20) return "二十";
  if (day === 30) return "三十";
  const prefix = day < 10 ? "初" : day < 20 ? "十" : day < 30 ? "廿" : "三十";
  const rem = day < 10 ? day : day < 20 ? day - 10 : day < 30 ? day - 20 : day - 30;
  if (rem === 0) return prefix;
  return prefix + CN_NUM[rem];
}
function lunarMonthCn(month: number, leap: boolean): string {
  const names = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  return (leap ? "闰" : "") + names[month - 1] + "月";
}

/** Lunar data table for years 1900–2100.
 *  Each 16-bit value encodes: bits 4-15 → 12 lunar months (0=29d, 1=30d); bits 0-3 → leap month index (0=no leap);
 *  a 17th high bit is set if the leap month itself is 30 days. Sourced from public lunar calendar tables. */
const LUNAR_INFO: number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

/** Days between (year1, month1, day1) and (year2, month2, day2) in Gregorian calendar. */
function daysBetween(y1: number, m1: number, d1: number, y2: number, m2: number, d2: number): number {
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

/** Total days in a lunar year. */
function lunarYearDays(year: number): number {
  let sum = 348; // 12 * 29
  const info = LUNAR_INFO[year - 1900];
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (info & i) ? 1 : 0;
  }
  return sum + leapDays(year);
}

/** Leap month index (1-12) or 0 if none. */
function leapMonth(year: number): number {
  return LUNAR_INFO[year - 1900] & 0xf;
}

/** Days in the leap month of a given year (0 if none). */
function leapDays(year: number): number {
  if (leapMonth(year) === 0) return 0;
  return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
}

/** Days in the m-th (non-leap) lunar month of a given year. */
function monthDays(year: number, month: number): number {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

/** Convert a Gregorian date to lunar (year, month-name, day-name). */
function solarToLunar(date: Date): { year: number; month: number; day: number; leap: boolean } {
  let offset = daysBetween(1900, 1, 31, date.getFullYear(), date.getMonth() + 1, date.getDate());
  let year = 1900;
  let temp = 0;
  while (year < 2101 && offset > 0) {
    temp = lunarYearDays(year);
    if (offset < temp) break;
    offset -= temp;
    year++;
  }
  const leap = leapMonth(year);
  let isLeap = false;
  let month = 1;
  temp = 0;
  while (month < 13 && offset >= 0) {
    if (leap > 0 && month === leap + 1 && !isLeap) {
      month--;
      isLeap = true;
      temp = leapDays(year);
    } else {
      temp = monthDays(year, month);
    }
    if (isLeap && month === leap + 1) isLeap = false;
    offset -= temp;
    if (offset < 0) { offset += temp; break; }
    month++;
  }
  const day = offset + 1;
  return { year, month, day, leap: isLeap };
}

function getLunarYear(date: Date): number {
  return solarToLunar(date).year;
}

function getLunarDate(date: Date): [string, string] {
  const { month, day, leap } = solarToLunar(date);
  return [lunarMonthCn(month, leap), lunarDayCn(day)];
}
