import requests
import cloudscraper
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NewsCircuitBreaker:
    def __init__(self, target_currency="USD", pre_minutes=15, post_minutes=15):
        self.target_currency = target_currency
        self.pre_minutes = timedelta(minutes=pre_minutes)
        self.post_minutes = timedelta(minutes=post_minutes)
        self.high_impact_events = []
        self.last_fetch_time = None
        
        # We need headers to mimic a real browser, otherwise ForexFactory blocks the request
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }

    def fetch_daily_events(self):
        """Fetches today's high-impact events from ForexFactory."""
        try:
            logger.info("Fetching daily calendar from ForexFactory...")
            # Using the daily calendar URL
            url = "https://www.forexfactory.com/calendar?day=today"
            # Use cloudscraper to bypass Cloudflare 403 Forbidden checks
            scraper = cloudscraper.create_scraper()
            response = scraper.get(url, headers=self.headers, timeout=15)
            response.raise_for_status()
            
            self._parse_html(response.text)
            self.last_fetch_time = datetime.now()
            
            logger.info(f"Found {len(self.high_impact_events)} high-impact {self.target_currency} events today.")
            for event in self.high_impact_events:
                logger.info(f" - {event['time'].strftime('%H:%M')} : {event['name']}")
                
            return True
        except Exception as e:
            logger.error(f"Failed to fetch news calendar: {e}")
            print("⚠️ News Scraper Blocked (403). Checking config/news_config.json fallback...")
            self._load_manual_config()
            self.last_fetch_time = datetime.now()
            return False

    def _load_manual_config(self):
        """Loads manual news events from config/news_config.json when ForexFactory is blocked."""
        import json
        try:
            with open("config/news_config.json", "r") as f:
                config = json.load(f)

            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            self.high_impact_events = []

            for event in config.get("events", []):
                if event.get("date") != today_str:
                    continue

                time_parts = event["time_utc"].split(":")
                event_dt = datetime.combine(
                    datetime.utcnow().date(),
                    datetime.strptime(event["time_utc"], "%H:%M").time()
                )

                pre = timedelta(minutes=event.get("pre_minutes", self.pre_minutes.total_seconds() / 60))
                post = timedelta(minutes=event.get("post_minutes", self.post_minutes.total_seconds() / 60))

                self.high_impact_events.append({
                    "time": event_dt,
                    "name": event.get("title", "Manual Event"),
                    "pre": pre,
                    "post": post
                })

            if self.high_impact_events:
                print(f"📰 Loaded {len(self.high_impact_events)} manual news event(s) from news_config.json:")
                for ev in self.high_impact_events:
                    pre_min = int(ev.get("pre", self.pre_minutes).total_seconds() / 60)
                    post_min = int(ev.get("post", self.post_minutes).total_seconds() / 60)
                    print(f"   🔴 {ev['name']} at {ev['time'].strftime('%H:%M')} UTC (blackout: -{pre_min}m / +{post_min}m)")
            else:
                print("📰 No manual news events for today in news_config.json. Proceeding with technicals only.")
        except FileNotFoundError:
            print("⚠️ config/news_config.json not found. Proceeding with technicals only.")
            self.high_impact_events = []
        except Exception as ex:
            print(f"⚠️ Failed to load news_config.json: {ex}")
            self.high_impact_events = []

    def _parse_html(self, html):
        """Parses the ForexFactory HTML table and extracts high-impact USD events."""
        soup = BeautifulSoup(html, 'html.parser')
        calendar_table = soup.find('table', class_='calendar__table')
        
        if not calendar_table:
            logger.warning("Could not find calendar table in HTML.")
            return
 
        self.high_impact_events = []
        today = datetime.now()
        current_time_str = None

        for row in calendar_table.find_all('tr', class_='calendar__row'):
            # Skip rows that are just date headers
            if 'calendar__row--new-day' in row.get('class', []):
                continue
                
            # Date/Time extraction
            time_td = row.find('td', class_='calendar__time')
            if time_td and time_td.text.strip():
                # Some rows don't have time if they fall under the previous time block
                # However, ForexFactory usually formats times like "8:30am", "All Day", etc.
                raw_time = time_td.text.strip()
                if raw_time != "All Day" and raw_time != "Day 1" and raw_time != "Tentative":
                    current_time_str = raw_time

            if not current_time_str:
                continue

            # Currency extraction
            currency_td = row.find('td', class_='calendar__currency')
            if not currency_td:
                continue
            currency = currency_td.text.strip()

            # Impact extraction (ForexFactory uses an icon to denote impact)
            impact_td = row.find('td', class_='calendar__impact')
            if not impact_td:
                continue
            
            # The span class inside the impact cell dictates the color (red = high)
            impact_span = impact_td.find('span')
            is_high_impact = False
            if impact_span and 'high' in impact_span.get('class', [''])[0]:
                 is_high_impact = True

            # Event Name
            event_td = row.find('td', class_='calendar__event')
            event_name = event_td.text.strip() if event_td else "Unknown Event"

            # Filter for our target currency and High Impact
            if currency == self.target_currency and is_high_impact:
                try:
                    # Convert "8:30am" string into a datetime object for today
                    parsed_time = datetime.strptime(current_time_str, "%I:%M%p").time()
                    event_dt = datetime.combine(today.date(), parsed_time)
                    
                    self.high_impact_events.append({
                        "time": event_dt,
                        "name": event_name
                    })
                except ValueError:
                    logger.warning(f"Could not parse time string: {current_time_str}")

    def is_trading_allowed(self, current_time=None):
        """
        Checks if the current time is inside a news blocked window.
        Returns False if we are near a high-impact event, True otherwise.
        """
        if current_time is None:
            current_time = datetime.now()
            
        # If we haven't fetched today, or it's a new day, fetch again
        if not self.last_fetch_time or self.last_fetch_time.date() != current_time.date():
             self.fetch_daily_events()

        # Check against all high-impact events
        for event in self.high_impact_events:
            event_time = event["time"]
            # Use per-event pre/post if available (from news_config.json), else global defaults
            pre = event.get("pre", self.pre_minutes)
            post = event.get("post", self.post_minutes)
            block_start = event_time - pre
            block_end = event_time + post
            
            if block_start <= current_time <= block_end:
                 logger.warning(f"🚫 TRADING BLOCKED: News event '{event['name']}' at {event_time.strftime('%H:%M')}")
                 return False
                 
        return True

if __name__ == "__main__":
    breaker = NewsCircuitBreaker()
    breaker.fetch_daily_events()
    print("Is trading allowed right now?", breaker.is_trading_allowed())
