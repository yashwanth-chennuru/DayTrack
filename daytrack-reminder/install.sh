#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/daytrack-reminder.log"

echo "Setting up DayTrack reminder cron job..."
echo "Directory: $SCRIPT_DIR"

# Ensure the log file exists and is writable (requires sudo if in /var/log)
# If you don't have sudo, change LOG_FILE to "$SCRIPT_DIR/reminder.log"
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="$SCRIPT_DIR/reminder.log"
echo "Log file: $LOG_FILE"

# Create a temporary file for the new cron job
CRON_TMP=$(mktemp)

# Dump existing cron jobs to the temp file
crontab -l > "$CRON_TMP" 2>/dev/null

# Remove any existing daytrack cron jobs to avoid duplicates
sed -i.bak '/daytrack-reminder/d' "$CRON_TMP" 2>/dev/null || sed -i '/daytrack-reminder/d' "$CRON_TMP"

# Append the new job: run every 20 minutes
echo "*/20 * * * * /usr/bin/env node \"$SCRIPT_DIR/reminder.mjs\" >> \"$LOG_FILE\" 2>&1" >> "$CRON_TMP"

# Install the new crontab
crontab "$CRON_TMP"
rm "$CRON_TMP"*

echo "Cron job installed successfully! It will run every 20 minutes."
echo "To view logs, run: tail -f $LOG_FILE"
