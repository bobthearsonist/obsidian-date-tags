class DateHelper {
  static formatTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')} ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}`;
  }

  static buildDateTag(baseTag, date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${baseTag}/${year}/${month}/${day}`;
  }

  static parseDateInput(dateInput = new Date()) {
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) {
        throw new Error('Invalid Date object');
      }
      return dateInput;
    }

    if (typeof dateInput === 'string') {
      const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(dateInput.trim());
      if (compact) {
        return DateHelper.fromLocalDateParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
      }

      const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
      if (dashed) {
        return DateHelper.fromLocalDateParts(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
      }
    }

    throw new Error('Expected date input as Date, YYYY-MM-DD, or YYYYMMDD');
  }

  static fromLocalDateParts(year, month, day) {
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw new Error('Invalid calendar date');
    }
    return parsed;
  }

  static parseCreatedDate(frontmatterData) {
    const created = frontmatterData.created;
    if (!created) return null;

    // `new Date('YYYY-MM-DD')` is UTC midnight, which lands on the previous
    // day west of UTC; a bare date in frontmatter means the user's local day.
    if (typeof created === 'string') {
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(created.trim());
      if (dateOnly) {
        try {
          return DateHelper.fromLocalDateParts(
            Number(dateOnly[1]),
            Number(dateOnly[2]),
            Number(dateOnly[3])
          );
        } catch {
          return null;
        }
      }
    }

    const date = new Date(created);
    return isNaN(date.getTime()) ? null : date;
  }
}

module.exports = DateHelper;
