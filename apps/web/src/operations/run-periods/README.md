# run-periods

Runs counted by period, in the person's words: the periods Home, a workflow and Runs offer, the window a period covers up to now and the one before it, the buckets of the runs chart in the viewer's time zone and the period in the Runs address. Business logic without UI. "Now" and the time zone are arguments, never read from a clock.

Owner: web — runs. Decisions: research D4 of the console redesign (005); information architecture §2 (the Runs address), §4 (statuses) and §5 (Home, A workflow, Runs); the wording and behaviour of the approved mockup's `series`, `counts`, `figures`, `periodPhrase`, `PERIOD_WORDS` and `runsAddr`.

## API

- `PERIODS` (`24h`, `7d`, `30d`) and `STARTED` (the same and `all`), in the order the controls show them.
- `periodLabel(started)`: "24 hours", "7 days", "30 days", "Any time". `periodPhrase(started)`: "in the last 7 days", "at any time".
- `windowsOf(period, now, zone)`, for an ISO instant and an IANA time zone (the name the api receives):
  - `current`: from the start of the first bucket to now. A run belongs to it by its start time.
  - `previous`: as long as `current`, ending where `current` starts; the comparison's period.
  - `unit`: `hour` for 24 hours, `day` for 7 and 30 days.
  - `buckets`, in order, each with `from`, `to` and `label`. 24 hours are the current hour and the 23 before it ("17:00"); 7 days are today and the 6 days before it ("Mon 16"); 30 days are today and the 29 days before it ("16 Nov"). The last bucket ends now.
  - Days start at midnight in the viewer's zone, so the day of a daylight-saving change lasts 23 or 25 hours; an hour the clocks skip is absent and one they repeat is there twice. A day whose midnight is skipped starts when the clocks jump; one whose midnight comes twice starts at the first.
- `countWindowOf(windows)`: what `/instance-counts` is asked for: the start of every bucket, `to` (now) and `previousFrom`. This operation is the one owner of the edges; the api counts runs between the starts it is given.
- `figuresOf(total, previous)`: Started (every phase), Succeeded, Failed and Cancelled of the period, each with its count in the previous period, or `null` when none was counted. `inProgressOf(now)`: the live count of runs still going (queued, running, waiting, paused), whenever they started (the api's `LIVE_PHASES`, named once in data-access). `liveWindowOf(now)`: what `/instance-counts` is asked for to read only the live count: the minute up to now.
- `seriesOf(buckets, counted)`: one bar per bucket, its label and edges with Succeeded, Failed, Cancelled and In progress; a bucket the api did not count is empty.
- `chartNoteOf(unit, zone)`: "Each bar is an hour in your time zone, Europe/Kyiv.", or "… in UTC." while the viewer's zone is not known.
- `changeText(current, previous, period)`: "↑ from 8 the previous 7 days", "↓ from 8 …", "same as 8 …".
- `startedOf(text)`: the `started` parameter read back, or `null` for anything but `24h`, `7d`, `30d` and `all`.

"In progress" is a live count of now, apart from the period: Home's figure opens `status=in-progress&started=all`.

## Time zones

The platform's `Intl.DateTimeFormat` reads the wall clock of an instant in a zone. A wall time goes back to its instant through the zone's offsets a day before and a day after it. Labels are written in `en-GB`: a 24-hour clock, the day before the month.

## Playground

`run-periods.stories.tsx`: the windows and buckets of each period in Kyiv and New York, over the daylight-saving changes of March, October and November and across the end of October.
