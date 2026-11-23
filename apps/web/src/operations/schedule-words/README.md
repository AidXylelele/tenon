# schedule-words

How a workflow starts on its own, in words. A cron schedule has no time zone in the language and the api runs it in UTC, so the words say UTC and give the viewer's local time beside it. The schedule form's "Repeat" choices are read from a cron and written back to one. Business logic without UI. "Now" and the time zone are arguments, never read from a clock.

Owner: web — editor. Decisions: research D15 of the console redesign (005); information architecture §3 ("Starts", never a bare cron string); the approved mockup's schedule lines and `formStart`.

## API

- `scheduleText(schedule)` and `triggerText(trigger)`: a start in words, for the api's `Schedule` and the language server's `Trigger`: "Every 15 minutes", "30 seconds after the previous run ends", "When an event on com.acme.order.paid arrives", and a cron as `cronText` says it. `spanOf(milliseconds, written)`: a duration in words, or as written when it is an expression.
- `cronText(cron)`: "Every day at 09:00 UTC", "Every weekday at 06:30 UTC", "Every Monday and Thursday at 09:00 UTC", "Every hour", "Every hour at 15 minutes past", "Every 10 minutes", "Every minute". Any other cron, or one that does not parse, is shown as written: "On the schedule 0 2 1 * * (UTC)".
- `localTimeText(cron, now, zone)`: today's local equivalent of a schedule with one time of day: "11:00 your time", with ", the next day" or ", the day before" when a weekly or weekday start falls on another local day. `null` for a schedule without one time of day.
- `daylightNote(cron, now, zone)`: when daylight saving moves a start of the next 7 days to another local time, "From Sun 29 Mar it starts at 12:00 your time: local time shifts with daylight saving, the schedule stays in UTC."; otherwise `null`.
- `nextStartsOf(cron, now, count)`: the next starts after now, as ISO instants; none for a cron that does not parse or never comes. Days match as in Vixie cron: when both the day of the month and the weekday are restricted, a day that matches either runs.
- `startText(start, zone)`: "Mon 23 Nov 09:00 UTC · 11:00 your time", with the local date when it differs: "Mon 23 Nov 23:30 UTC · Tue 24 Nov 01:30 your time".
- `Repeat`, the form's choices: `daily`, `weekdays` and `weekly` at a `TimeOfDay` in UTC (`weekly` on its `Weekday`s, 0 for Sunday), `hourly` at a minute, `minutes` every n minutes (a divisor of 60), `custom` with its cron.
  - `FIRST_CRON`: the cron a new schedule starts from, every day at 09:00 UTC (`0 9 * * *`).
  - `REPEAT_CHOICES`: the six choices in the form's order, each at its starting values (09:00, Monday, every 10 minutes); `repeatLabel(repeat)`: "Every day", "Every weekday", "Every hour", "Every 10 minutes", "Every week on…", "A custom schedule (cron)".
  - `repeatOf(cron)`: the choice a cron reads as, `custom` when none fits. `cronOf(repeat)`: the cron it writes, such as `0 9 * * 1-5`.

The cron is the language's five fields: lists, ranges and steps (`a/n` runs to the field's end), months and weekdays by name in any case, 7 also Sunday.

## Playground

`schedule-words.stories.tsx`: schedules before the daylight-saving changes of March in Kyiv and of November in New York, starts that fall on another local day, every 10 minutes and a custom cron.
