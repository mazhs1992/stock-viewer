"""Trading date calculation using NYSE calendar."""
import datetime as dt
import exchange_calendars as xcals


def get_trading_date(now: dt.datetime | None = None) -> dt.date:
    """Get the date of the latest US close.

    A run at 04:00 UTC Tuesday belongs to Monday's close.
    """
    if now is None:
        now = dt.datetime.now(dt.timezone.utc)

    nyse = xcals.get_calendar("XNYS")
    today = now.date()

    # If market is open or hasn't closed yet today (before ~21:00 UTC),
    # use the previous session
    if nyse.is_session(today):
        # US market closes at ~21:00 UTC (16:00 ET)
        close_time = dt.datetime.combine(today, dt.time(21, 0), tzinfo=dt.timezone.utc)
        if now >= close_time:
            return today
    # Fall back to previous session
    prev = nyse.previous_session(today)
    return prev.date() if hasattr(prev, 'date') else prev


def is_trading_day(d: dt.date) -> bool:
    """Check if a date is a NYSE trading day."""
    nyse = xcals.get_calendar("XNYS")
    return nyse.is_session(d)


def trading_dates_range(start: dt.date, end: dt.date) -> list[dt.date]:
    """Get all NYSE trading dates in [start, end]."""
    nyse = xcals.get_calendar("XNYS")
    sessions = nyse.sessions_in_range(start, end)
    return [s.date() if hasattr(s, 'date') else s for s in sessions]
