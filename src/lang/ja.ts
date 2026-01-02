const dict = {
  today: "今日",
  tomorrow: "明日",
  yesterday: "昨日",
  next: "次|翌|来", // "Tsugi/Yoku/Rai" (ex: Rai-shu = Semaine prochaine)
  last: "前|去|先|昨", // "Mae/Kyo/Sen/Saku" (ex: Sen-shu = Semaine dernière)
  this: "今|本|当", // "Ima/Hon/To" (ex: Kon-shu = Cette semaine)
  in: "あと|ato", // "Ato" (Pour dire "Dans X minutes" -> "Ato X fun")
  week: "週",
  month: "月",
  year: "年",
  sunday: "日曜日",
  monday: "月曜日",
  tuesday: "火曜日",
  wednesday: "水曜日",
  thursday: "木曜日",
  friday: "金曜日",
  saturday: "土曜日",
  inminutes: "%{timeDelta}分後", // X minutes after
  inhours: "%{timeDelta}時間後",
  indays: "%{timeDelta}日後",
  inweeks: "%{timeDelta}週間後",
  inmonths: "%{timeDelta}ヶ月後",
  daysago: "%{timeDelta}日前", // X days ago
  weeksago: "%{timeDelta}週間前",
  monthsago: "%{timeDelta}ヶ月前",
  time: "時間",
  now: "今", // Ima (Maintenant)
  plusminutes: "+%{timeDelta} 分",
  minusminutes: "-%{timeDelta} 分",
  plushour: "+%{timeDelta} 時間",
  minushour: "-%{timeDelta} 時間",
  minute: "分|ふん|ぷん|fun",
  hour: "時間|じかん|時|じ",
  day: "日|にち",
  week: "週|週間|しゅう|しゅうかん",
  month: "月|ヶ月|かげつ|がつ",
  year: "年|ねん",
} as const;

export default dict;