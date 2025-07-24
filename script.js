const map = L.map("map").setView([49.2827, -123.1207], 11); // Centered on Vancouver

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
}).addTo(map);

const stationMarkers = {};
const stationData = {}; // To hold all station and platform info
let trainJourneys = {}; // To hold all train journey data
let trainStates = {}; // To hold the current state of each train
let stationTrainCount = {}; // To count how many trains are at each station
let stationSchedules = {}; // To hold schedule for each station
let openPopupInfo = null; // To track the currently open popup

const lineColors = {
    "Canada Line": "#008CB5",
    "Expo Line": "#005DAB",
    "Millennium Line": "#E1B903",
};

const highlightColors = {
    "Canada Line": "#00ffff", // Neon Cyan
    "Expo Line": "#009DFF", // Neon Blue
    "Millennium Line": "#ffff00", // Neon Yellow
};

// Function to fetch and plot station data
async function plotStations() {
    try {
        const response = await fetch("stations_for_map.csv");
        const data = await response.text();
        const rows = data.split("\n").slice(1);

        rows.forEach((row) => {
            const cols = row.split(",");
            if (cols.length >= 4) {
                const stopNameRaw = cols[0];
                const lat = parseFloat(cols[1]);
                const lon = parseFloat(cols[2]);
                const line = cols[3].trim();
                const stationName = stopNameRaw.split(" @ ")[0];

                if (!stationData[stationName]) {
                    stationData[stationName] = {
                        platforms: [],
                        center: { lat: 0, lon: 0 },
                    };
                }
                stationData[stationName].platforms.push({
                    stopNameRaw,
                    lat,
                    lon,
                    line,
                });
            }
        });

        Object.keys(stationData).forEach((stationName) => {
            const station = stationData[stationName];
            const platformCount = station.platforms.length;

            if (platformCount > 0) {
                // Calculate the center point for the station
                station.center.lat =
                    station.platforms.reduce((sum, p) => sum + p.lat, 0) /
                    platformCount;
                station.center.lon =
                    station.platforms.reduce((sum, p) => sum + p.lon, 0) /
                    platformCount;

                // Create a marker for each platform
                station.platforms.forEach((platform) => {
                    addMarker(
                        platform.stopNameRaw,
                        platform.lat,
                        platform.lon,
                        platform.line
                    );
                });
            }
        });

        // --- Set initial view to fit all stations ---
        if (Object.keys(stationMarkers).length > 0) {
            const allMarkers = Object.values(stationMarkers);
            const featureGroup = L.featureGroup(allMarkers);
            map.fitBounds(featureGroup.getBounds().pad(0.1)); // .pad(0.1) adds 10% padding
        }

        // Initial update of marker positions
        updateMarkerPositions();

        // Load the journeys and start the train tracking clock
        await loadJourneys();
        await loadStationSchedules();
        startTrainTracker();
    } catch (error) {
        console.error("Error fetching or parsing station data:", error);
    }
}

function addMarker(stopName, lat, lon, line) {
    if (!isNaN(lat) && !isNaN(lon)) {
        const color = lineColors[line] || "#ff7800";

        const marker = L.circleMarker([lat, lon], {
            radius: 5,
            fillColor: color,
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
        }).addTo(map);

        marker.options.originalColor = color;

        // Bind a popup that gets its content from a function
        marker.bindPopup(() => getPopupContent(stopName));

        // When a popup is opened, store its info
        marker.on("popupopen", () => {
            openPopupInfo = { marker, stopName };
        });

        stationMarkers[stopName] = marker;
        stationTrainCount[stopName] = 0;
    }
}

function updateMarkerPositions() {
    const zoom = map.getZoom();
    // Define max and min spread based on zoom
    const maxSpread = 0.0011; // Increased from 0.0004
    const minZoom = 10;
    const maxZoom = 17;
    let spread = maxSpread * ((maxZoom - zoom) / (maxZoom - minZoom));
    spread = Math.max(0, Math.min(maxSpread, spread));

    Object.keys(stationData).forEach((stationName) => {
        const station = stationData[stationName];
        if (station.platforms.length > 1) {
            const N = station.platforms.length;
            station.platforms.forEach((platform, index) => {
                const marker = stationMarkers[platform.stopNameRaw];
                if (marker) {
                    if (spread > 0) {
                        const angle = ((2 * Math.PI) / N) * index;
                        const newLat =
                            station.center.lat + spread * Math.sin(angle);
                        const newLon =
                            station.center.lon +
                            (spread * Math.cos(angle)) /
                                Math.cos((station.center.lat * Math.PI) / 180);
                        marker.setLatLng([newLat, newLon]);
                    } else {
                        marker.setLatLng([platform.lat, platform.lon]);
                    }
                }
            });
        }
    });
}

map.on("zoomend", updateMarkerPositions);
// When a popup is closed anywhere on the map, clear the info
map.on("popupclose", () => {
    openPopupInfo = null;
});

// --- Data Loading ---

async function loadStationSchedules() {
    try {
        const response = await fetch("station_schedules.json");
        stationSchedules = await response.json();
        console.log("Station schedules loaded.");
    } catch (error) {
        console.error("Error loading station schedules:", error);
    }
}

async function loadJourneys() {
    try {
        const response = await fetch("train_journeys.json");
        trainJourneys = await response.json();

        // Initialize train states
        Object.keys(trainJourneys).forEach((tripId) => {
            trainStates[tripId] = {
                lastStation: null,
                nextStopIndex: 0,
            };
        });

        console.log("Train journeys loaded and initialized.");
    } catch (error) {
        console.error("Error loading train journeys data:", error);
    }
}

// --- Train Tracking Logic ---

function updateTrainPositions() {
    const now = new Date();
    const secondsToday =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    // --- Update popup content if one is open ---
    if (openPopupInfo && openPopupInfo.marker.isPopupOpen()) {
        const newContent = getPopupContent(openPopupInfo.stopName);
        openPopupInfo.marker.setPopupContent(newContent);
    }

    Object.keys(trainJourneys).forEach((tripId) => {
        const journey = trainJourneys[tripId];
        let state = trainStates[tripId];

        // Find the current stop for this train
        let currentStop = null;
        for (let i = state.nextStopIndex; i < journey.stops.length; i++) {
            if (journey.stops[i].arrival_time <= secondsToday) {
                currentStop = journey.stops[i];
                state.nextStopIndex = i + 1;
            } else {
                break; // Stop looking once we are in the future
            }
        }

        if (currentStop) {
            const newStation = currentStop.stop_name;
            const oldStation = state.lastStation;

            if (newStation !== oldStation) {
                // Decrement count at old station and revert color if no trains left
                if (oldStation && stationMarkers[oldStation]) {
                    stationTrainCount[oldStation]--;
                    if (stationTrainCount[oldStation] === 0) {
                        const oldMarker = stationMarkers[oldStation];
                        oldMarker.setStyle({
                            fillColor: oldMarker.options.originalColor,
                        });
                    }
                }

                // Increment count at new station and highlight it
                if (stationMarkers[newStation]) {
                    stationTrainCount[newStation]++;
                    const newMarker = stationMarkers[newStation];
                    const highlightColor =
                        highlightColors[journey.line] || "#00ff00"; // Default to green
                    newMarker.setStyle({ fillColor: highlightColor });
                }

                state.lastStation = newStation;
            }
        }
    });
}

function startTrainTracker() {
    setInterval(updateTrainPositions, 1000);
    console.log("Train tracker started.");
}

// --- Popup Content Generation ---

function getPopupContent(stopName) {
    const schedule = stationSchedules[stopName];
    if (!schedule) {
        return `<b>${stopName}</b><br>No schedule data available.`;
    }

    const now = new Date();
    const secondsToday =
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const upcomingArrivals = schedule
        .filter((arrival) => arrival.time >= secondsToday)
        .slice(0, 3);

    let content = `<b>${stopName}</b><br><br><b>Next Arrivals:</b><br>`;

    if (upcomingArrivals.length === 0) {
        content += "No more trains today.";
    } else {
        upcomingArrivals.forEach((arrival) => {
            const diffSeconds = arrival.time - secondsToday;
            const arrivalText = formatCountdown(diffSeconds);
            content += `- ${arrival.direction} (${arrivalText})<br>`;
        });
    }

    return content;
}

function formatCountdown(seconds) {
    if (seconds < 60) {
        return "Now";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const paddedSeconds =
        remainingSeconds < 10 ? `0${remainingSeconds}` : remainingSeconds;
    return `${minutes}m ${paddedSeconds}s`;
}

plotStations();
