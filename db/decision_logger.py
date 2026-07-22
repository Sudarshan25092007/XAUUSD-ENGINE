import csv
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class DecisionLogger:
    def __init__(self, filename="db/Tick_Data.csv"):
        self.filename = filename
        self.headers = ["Timestamp", "Signal", "Session", "Price", "Verdict", "Reason"]
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Creates the CSV file and writes headers if it doesn't exist."""
        # Ensure the directory exists
        os.makedirs(os.path.dirname(self.filename), exist_ok=True)
        
        file_exists = os.path.exists(self.filename)
        
        if not file_exists:
            try:
                with open(self.filename, mode='w', newline='') as file:
                    writer = csv.writer(file)
                    writer.writerow(self.headers)
                logger.info(f"Created tracking file: {self.filename}")
            except Exception as e:
                logger.error(f"Failed to create trackig file {self.filename}: {e}")

    def log_decision(self, signal, session, price, verdict, reason):
        """Appends a new decision row to the CSV."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        row = [timestamp, signal, session, price, verdict, reason]
        
        try:
            with open(self.filename, mode='a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(row)
            logger.info(f"📝 Logged Decision: {verdict} - {reason} ({signal} @ {price})")
        except Exception as e:
             logger.error(f"Failed to write to {self.filename}: {e}")
