/**
 * Date formatting helpers built on the native Intl API.
 * They replace moment.js, which shipped ~300 kB for exactly these two calls.
 */

const RELATIVE_TIME_DIVISIONS: {
    amount: number;
    unit: Intl.RelativeTimeFormatUnit;
}[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

function parseDate(dateString: string | undefined | null): Date | null {
    if (!dateString) return null;
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fixed `DD.MM.YYYY HH:mm` format, locale-independent
 * (same output as the previous moment(...).format('DD.MM.YYYY HH:mm')).
 */
export function formatDateTime(dateString: string | undefined | null): string {
    const date = parseDate(dateString);
    if (!date) return '';
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Localized "x minutes ago" / "za 2 godziny" string, like moment's fromNow(),
 * without mutating any global locale state.
 */
export function relativeTimeFrom(
    dateString: string | undefined | null,
    lang: string,
): string {
    const date = parseDate(dateString);
    if (!date) return '';

    const formatter = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    let duration = (date.getTime() - Date.now()) / 1000;

    for (const division of RELATIVE_TIME_DIVISIONS) {
        if (Math.abs(duration) < division.amount) {
            return formatter.format(Math.round(duration), division.unit);
        }
        duration /= division.amount;
    }
    return '';
}
