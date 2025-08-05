# Vancouver SkyTrain Real-Time Tracker

This project is an interactive, real-time map that visualizes the Vancouver SkyTrain network. It tracks the live positions of all trains on the Expo, Millennium, and Canada Lines, providing a dynamic and engaging view of the city's transit system. The data is processed from the official GTFS transit feed provided by TransLink.

## Features

-   **Live Train Tracking:** Displays the real-time location of every SkyTrain, with markers moving from station to station based on the official schedule.
-   **Interactive Map:** A fully interactive map built with Leaflet.js, allowing users to zoom and pan.
-   **Line-Specific Coloring:** Stations and highlights are color-coded to match their respective lines (Expo, Millennium, Canada) for easy identification.
-   **Dynamic Marker Placement:** Station platform markers are placed at their precise GPS coordinates when zoomed in, and elegantly spread out to avoid overlap when zoomed out.
-   **Real-Time Arrival Info:** Clicking on a station opens a popup with live, second-by-second countdowns for the next three arriving trains, including their destinations.
-   **Automatic Smart Zoom:** On page load, the map automatically adjusts its zoom level to perfectly frame the entire SkyTrain network.
-   **Date-Aware Scheduling:** The application is smart enough to know the current day and only displays the schedule for trains that are active today (e.g., weekday vs. weekend service).
-   **SkyTrain Route Overlays:** Displays the exact GPS-tracked routes of all three SkyTrain lines (Expo, Millennium, and Canada Lines) with their official TransLink colors.
-   **Interactive Route Toggle:** A dedicated toggle button allows users to show/hide the route overlays while maintaining proper layer ordering.

## Setup and Installation

To get the project running locally, follow these steps:

### 1. Prerequisites

-   Python 3.x
-   `pip` for installing Python packages

### 2. Data Source

The project relies on GTFS (General Transit Feed Specification) data. The required data is already included in the `google_transit/` directory.

To download the latest data, you can use the [TransLink GTFS Static Data](https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources/gtfs/gtfs-data) website.

### 3. Generate Data Files

Before launching the web application, you need to run Python scripts to process the raw GTFS data into formats that the web interface can use. These scripts intelligently filter the schedule to only include trains running on the current day and extract the precise route geometries.

First, install the necessary Python libraries:

```bash
pip install pandas
```

Then, run the data processing scripts:

```bash
# Generate schedule and station data
python format_data.py

# Extract SkyTrain route geometries
python extract_routes.py
```

This will create/update four essential files:

-   `stations_for_map.csv` - Station coordinates and line information
-   `train_journeys.json` - Real-time train journey data
-   `station_schedules.json` - Station arrival schedules
-   `skytrain_routes.geojson` - Precise GPS coordinates for all SkyTrain routes

You only need to run these scripts once, or whenever you update the GTFS data in the `google_transit/` directory.

## Running the Application

To view the tracker locally, you need to serve the files using a local web server. This is because modern browsers have security restrictions (CORS) that prevent web pages from loading local files directly via `fetch`.

A simple way to do this is with Python's built-in HTTP server.

1.  Open your terminal in the project's root directory.
2.  Run the following command:

    ```bash
    # For Python 3
    python -m http.server
    ```

3.  The terminal will show a message like `Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...`.
4.  Open your web browser and navigate to:

    [http://localhost:8000](http://localhost:8000)

You should now see the live SkyTrain tracker in action! The map will display:

-   **Station markers** in their respective line colors
-   **SkyTrain route overlays** showing the exact paths of all three lines
-   **Interactive controls** including a route toggle button (🚇) in the top-right corner
-   **Real-time train tracking** with live arrival information when you click on stations

The route overlays use the official TransLink color scheme:

-   **Expo Line**: Blue (#005dab)
-   **Millennium Line**: Yellow (#ffd204)
-   **Canada Line**: Teal (#009ac7)
