"""The cadence rule that decides when a scheduled intelligence sync is owed.

Worth testing directly: this is what stops a paid source (Apify, SerpApi, YouTube) being
billed more often than the product promises, and what stopped competitor ads being billed
at all. Before this rule existed the cadence lived in an APScheduler IntervalTrigger armed
relative to boot, backed by the default in-memory job store - so process uptime, not the
last run, decided when a sync fired. In production that meant no competitor-ad run was even
attempted between 2026-09-25 and 2026-11-03, against a fifteen-day cadence.
"""
from datetime import datetime, timedelta

from core.intel_sync import due_from, AD_SYNC_DAYS, TREND_SYNC_DAYS, RETRY_AFTER_FAILURE_DAYS

NOW = datetime(2026, 11, 3, 12, 0, 0)


def ago(**kw):
    return NOW - timedelta(**kw)


def test_never_synced_is_due():
    assert due_from(None, None, AD_SYNC_DAYS, NOW) is True


def test_success_waits_the_full_cadence():
    assert due_from("success", ago(days=AD_SYNC_DAYS - 1), AD_SYNC_DAYS, NOW) is False
    assert due_from("success", ago(days=AD_SYNC_DAYS), AD_SYNC_DAYS, NOW) is True


def test_trend_cadence_is_longer_than_the_ad_cadence():
    """A rival's live ad set turns over faster than a market read does."""
    assert TREND_SYNC_DAYS > AD_SYNC_DAYS
    twenty_days = ago(days=20)
    assert due_from("success", twenty_days, AD_SYNC_DAYS, NOW) is True
    assert due_from("success", twenty_days, TREND_SYNC_DAYS, NOW) is False


def test_failure_retries_sooner_than_the_cadence():
    """A run that failed for want of a token must resume once the token is added."""
    assert RETRY_AFTER_FAILURE_DAYS < AD_SYNC_DAYS
    assert due_from("failed", ago(hours=2), AD_SYNC_DAYS, NOW) is False
    assert due_from("failed", ago(days=RETRY_AFTER_FAILURE_DAYS), AD_SYNC_DAYS, NOW) is True


def test_skipped_retries_on_the_failure_schedule():
    """'No competitors saved yet' becomes false as soon as the user adds one."""
    assert due_from("skipped", ago(days=RETRY_AFTER_FAILURE_DAYS), AD_SYNC_DAYS, NOW) is True
    assert due_from("skipped", ago(hours=1), AD_SYNC_DAYS, NOW) is False


def test_the_production_backlog_is_recognised_as_overdue():
    """The exact state found in production: every competitor-ad run failed 38 days ago
    while market trends succeeded 7 days ago. Only the ads are owed a run."""
    assert due_from("failed", ago(days=38), AD_SYNC_DAYS, NOW) is True
    assert due_from("success", ago(days=7), TREND_SYNC_DAYS, NOW) is False


def test_a_restart_does_not_make_a_recent_sync_due_again():
    """The whole point: due-ness is read from the last run, so it survives a redeploy and
    a free-tier sleep/wake cycle unchanged."""
    just_ran = ago(minutes=5)
    for _ in range(10):  # ten boots in quick succession
        assert due_from("success", just_ran, AD_SYNC_DAYS, NOW) is False
