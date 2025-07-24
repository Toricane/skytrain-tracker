import pandas as pd

trips = pd.read_csv("google_transit/trips.txt")
stop_times = pd.read_csv("google_transit/stop_times.txt")
stops = pd.read_csv("google_transit/stops.txt")

# Filter trips for skytrains (Expo, Millennium, Canada Line)
skytrain_trips = trips[trips["trip_headsign"].str.contains(" Line", na=False)]

# Get all unique trip_ids for skytrain trips
skytrain_trip_ids = skytrain_trips["trip_id"].unique()

# Get all stop_times for skytrain trips
skytrain_stop_times = stop_times[stop_times["trip_id"].isin(skytrain_trip_ids)]

# Get all unique stop_ids for skytrain stations from the stop_times
skytrain_station_ids = skytrain_stop_times["stop_id"].unique()

# Filter stops to only get skytrain stations
skytrain_stations = stops[stops["stop_id"].isin(skytrain_station_ids)]

# For the final goal, we need to combine the information.
# Let's merge the dataframes to get all the data in one place.

# Merge stop times with trip information
skytrain_data = pd.merge(skytrain_stop_times, skytrain_trips, on="trip_id")

# Merge with station information
all_skytrain_data = pd.merge(skytrain_data, skytrain_stations, on="stop_id")

# Extract the line name from trip_headsign
all_skytrain_data["line"] = all_skytrain_data["trip_headsign"].str.extract(
    r"(\w+\sLine)"
)[0]

# Select and reorder columns for clarity
final_data = all_skytrain_data[
    [
        "stop_name",
        "line",
        "trip_headsign",  # direction
        "arrival_time",
        "departure_time",
        "stop_lat",
        "stop_lon",
    ]
]

# Save the dataframes to CSV files
# For stations, we only want unique stations, so we drop duplicates based on stop_name
# and keep the essential columns.
skytrain_stations_info = skytrain_stations[
    ["stop_name", "stop_lat", "stop_lon"]
].drop_duplicates(subset=["stop_name"])
skytrain_stations_info.to_csv("skytrain_stations.csv", index=False)

final_data.to_csv("skytrain_schedule.csv", index=False)

print("Skytrain station data saved to skytrain_stations.csv")
print("Full skytrain schedule data saved to skytrain_schedule.csv")
