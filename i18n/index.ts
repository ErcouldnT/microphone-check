import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

const translations = {
    tr: {
        calendar: "Takvim",
        stats: "İstatistikler",
        totalDays: "Toplam Gün Sayısı",
        totalVisits: "Toplam Kere",
        maxDaily: "Günlük Rekor",
        topMonth: "En Yoğun Ay",
        recentRecords: "Son Kayıtlar",
        noRecords: "Henüz kayıt yok.",
        visitedDays: "Gidilen Gün",
        summary: "Özeti",
        times: "kere",
        months: {
            0: "Ocak", 1: "Şubat", 2: "Mart", 3: "Nisan", 4: "Mayıs", 5: "Haziran",
            6: "Temmuz", 7: "Ağustos", 8: "Eylül", 9: "Ekim", 10: "Kasım", 11: "Aralık"
        },
        daysShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]
    },
    en: {
        calendar: "Calendar",
        stats: "Statistics",
        totalDays: "Total Days",
        totalVisits: "Total Visits",
        maxDaily: "Daily Record",
        topMonth: "Top Month",
        recentRecords: "Recent Records",
        noRecords: "No records yet.",
        visitedDays: "Days Visited",
        summary: "Summary",
        times: "times",
        months: {
            0: "January", 1: "February", 2: "March", 3: "April", 4: "May", 5: "June",
            6: "July", 7: "August", 8: "September", 9: "October", 10: "November", 11: "December"
        },
        daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    },
    ru: {
        calendar: "Календарь",
        stats: "Статистика",
        totalDays: "Всего дней",
        totalVisits: "Всего посещений",
        maxDaily: "Рекорд за день",
        topMonth: "Лучший месяц",
        recentRecords: "Недавние записи",
        noRecords: "Записей пока нет.",
        visitedDays: "Дней посещено",
        summary: "Сводка",
        times: "раз",
        months: {
            0: "Январь", 1: "Февраль", 2: "Март", 3: "Апрель", 4: "Май", 5: "Июнь",
            6: "Июль", 7: "Август", 8: "Сентябрь", 9: "Октябрь", 10: "Ноябрь", 11: "Декабрь"
        },
        daysShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
    }
};

const i18n = new I18n(translations);

// Set the locale once at the beginning of your app.
i18n.locale = Localization.getLocales()[0].languageCode ?? 'tr';

// When a translation isn't found in the current locale, fallback to the default locale
i18n.enableFallback = true;
i18n.defaultLocale = 'tr';

export default i18n;
