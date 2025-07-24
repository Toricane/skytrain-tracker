import json
from datetime import datetime

import pandas as pd


# --- Step 1: Determine active service_ids for today ---
def get_active_services():
    today = datetime.now()
    today_date_str = today.strftime("%Y%m%d")
    today_day_name = today.strftime("%A").lower()

    try:
        calendar_df = pd.read_csv("google_transit/calendar.txt")
        calendar_dates_df = pd.read_csv("google_transit/calendar_dates.txt")
    except FileNotFoundError:
        print(
            "Error: calendar.txt or calendar_dates.txt not found. Cannot determine active services."
        )
        return set()

    # Filter by day of the week and date range
    active_mask = (
        (calendar_df[today_day_name] == 1)
        & (calendar_df["start_date"] <= int(today_date_str))
        & (calendar_df["end_date"] >= int(today_date_str))
    )

    active_service_ids = set(calendar_df[active_mask]["service_id"])

    # Handle exceptions from calendar_dates.txt
    today_date_int = int(today_date_str)

    # Add services for today
    added_services = set(
        calendar_dates_df[
            (calendar_dates_df["date"] == today_date_int)
            & (calendar_dates_df["exception_type"] == 1)
        ]["service_id"]
    )
    active_service_ids.update(added_services)

    # Remove services for today
    removed_services = set(
        calendar_dates_df[
            (calendar_dates_df["date"] == today_date_int)
            & (calendar_dates_df["exception_type"] == 2)
        ]["service_id"]
    )
    active_service_ids.difference_update(removed_services)

    return active_service_ids


# --- Main script ---
trips = pd.read_csv("google_transit/trips.txt")
stop_times = pd.read_csv("google_transit/stop_times.txt")
stops = pd.read_csv("google_transit/stops.txt")

# Filter trips by active services for today
active_services = get_active_services()
if not active_services:
    print("Warning: No active services found for today. Output files will be empty.")
trips = trips[trips["service_id"].isin(active_services)]

# Filter for Skytrain trips
skytrain_trips = trips[trips["trip_headsign"].str.contains(" Line", na=False)].copy()

# Extract line name from trip_headsign
skytrain_trips["line"] = skytrain_trips["trip_headsign"].str.extract(r"(\w+\sLine)")[0]

# Merge with stop times and then with stops to get a complete dataframe
schedule_with_stops = pd.merge(skytrain_trips, stop_times, on="trip_id")
all_data = pd.merge(schedule_with_stops, stops, on="stop_id")

# --- Create station data for the map ---
station_map_data = all_data[
    ["stop_name", "stop_lat", "stop_lon", "line"]
].drop_duplicates()
station_map_data.to_csv("stations_for_map.csv", index=False)
print("Station data for map saved to stations_for_map.csv")


# Function to convert time string to seconds
def time_to_seconds(time_str):
    try:
        h, m, s = map(int, time_str.split(":"))
        if h >= 24:
            h -= 24
        return h * 3600 + m * 60 + s
    except:
        return None


# Sort data by trip and time
sorted_data = all_data.sort_values(by=["trip_id", "arrival_time"])

# --- Create train journeys JSON ---
journeys = {}
for trip_id, trip_data in sorted_data.groupby("trip_id"):
    line_name = trip_data["line"].iloc[0]
    journey_stops = []
    for _, row in trip_data.iterrows():
        arrival_seconds = time_to_seconds(row["arrival_time"])
        if arrival_seconds is not None:
            journey_stops.append(
                {"stop_name": row["stop_name"], "arrival_time": arrival_seconds}
            )
    if journey_stops:
        journeys[trip_id] = {"line": line_name, "stops": journey_stops}

with open("train_journeys.json", "w") as f:
    json.dump(journeys, f, indent=2)
print("Train journeys data saved to train_journeys.json")

# --- Create station schedules JSON ---
station_schedules = {}
for stop_name, stop_data in sorted_data.groupby("stop_name"):
    arrivals = []
    for _, row in stop_data.iterrows():
        arrival_seconds = time_to_seconds(row["arrival_time"])
        if arrival_seconds is not None:
            arrivals.append(
                {"time": arrival_seconds, "direction": row["trip_headsign"]}
            )
    arrivals.sort(key=lambda x: x["time"])
    station_schedules[stop_name] = arrivals

with open("station_schedules.json", "w") as f:
    json.dump(station_schedules, f, indent=2)
print("Station schedules data saved to station_schedules.json")
