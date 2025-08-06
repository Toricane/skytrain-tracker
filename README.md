# Vancouver Transit Real-Time Tracker

An interactive map that visualizes Vancouver's transit network, showing scheduled positions of SkyTrains, RapidBus, 99 B-Line, and SeaBus based on official TransLink GTFS schedule data.

## ✨ Key Features

-   🚊 **Schedule-based vehicle tracking** with smooth animations
-   🗺️ **Interactive map** with route overlays and station markers
-   📱 **Mobile-optimized** Progressive Web App (PWA)
-   ⏱️ **Live arrival times** at stations
-   🛤️ **Realistic route following** with accurate vehicle movement

## 🚇 Supported Services

-   **SkyTrain:** Expo, Millennium, and Canada Lines
-   **RapidBus:** All R-Line services (R1-R6)
-   **99 B-Line:** Broadway/10th Avenue service
-   **SeaBus:** Waterfront ↔ Lonsdale Quay

## 🚀 Quick Start

### Prerequisites

-   Python 3.x
-   Web browser

### Setup

1. **Install dependencies:**

    ```bash
    pip install pandas
    ```

2. **Generate data files:**

    ```bash
    python format_data.py
    python extract_routes.py
    ```

3. **Start local server:**

    ```bash
    python -m http.server
    ```

4. **Open browser:**
   Navigate to [http://localhost:8000](http://localhost:8000)

## 📊 Data Source

Uses official [TransLink GTFS data](https://www.translink.ca/about-us/doing-business-with-translink/app-developer-resources/gtfs/gtfs-data) included in the `google_transit/` directory.

## 🎨 Features

### Vehicle Movement

-   Realistic timing (30s stops for trains/buses, 3min for SeaBus)
-   Schedule-based route following
-   Smooth animations

### User Interface

-   Touch-friendly mobile controls
-   Route toggle button (🚇)
-   Live arrival countdowns
-   Dark/light mode support
-   PWA installation support

### Transit Colors

-   **Expo Line:** Blue (#005dab)
-   **Millennium Line:** Yellow (#ffd204)
-   **Canada Line:** Teal (#009ac7)
-   **RapidBus:** Green (#009f4a)
-   **99 B-Line:** Orange (#f37a22)
-   **SeaBus:** Brown (#87746b)
