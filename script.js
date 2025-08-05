const map = L.map("map").setView([49.2827, -123.1207], 10); // Centered on Vancouver, wider zoom

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Route overlay layer
let routeLayer = null;
let routeLayerGroup = null;

const stationMarkers = {};
const stationData = {}; // To hold all station and platform info
let trainJourneys = {}; // To hold all train journey data
let trainStates = {}; // To hold the current state of each train
let stationTrainCount = {}; // To count how many trains are at each station
let stationSchedules = {}; // To hold schedule for each station
let openPopupInfo = null; // To track the currently open popup

const lineColors = {
    // SkyTrain lines
    "Canada Line": "#008CB5",
    "Expo Line": "#005DAB",
    "Millennium Line": "#E1B903",

    // RapidBus lines - individual names but same color
    "R1 King George Blvd": "#008522",
    "R2 Marine Dr": "#008522",
    "R3 Lougheed Hwy": "#008522",
    "R4 41st Ave": "#008522",
    "R5 Hastings St": "#008522",
    "R6 Scott Rd": "#008522",

    // 99 B-Line
    "99 B-Line": "#D04110",

    // SeaBus
    SeaBus: "#746661",
};

const highlightColors = {
    // SkyTrain lines
    "Canada Line": "#00ffff", // Neon Cyan
    "Expo Line": "#009DFF", // Neon Blue
    "Millennium Line": "#ffff00", // Neon Yellow

    // RapidBus lines - individual names but same color
    "R1 King George Blvd": "#00ff00", // Neon Green
    "R2 Marine Dr": "#00ff00", // Neon Green
    "R3 Lougheed Hwy": "#00ff00", // Neon Green
    "R4 41st Ave": "#00ff00", // Neon Green
    "R5 Hastings St": "#00ff00", // Neon Green
    "R6 Scott Rd": "#00ff00", // Neon Green

    // 99 B-Line
    "99 B-Line": "#ff6600", // Neon Orange

    // SeaBus
    SeaBus: "#ffcc99", // Light Brown
};

// Function to load and display transit routes
async function loadRoutes() {
    try {
        const response = await fetch("transit_routes.geojson");
        const routeData = await response.json();

        // Remove existing route layer if it exists
        if (routeLayer) {
            map.removeLayer(routeLayer);
        }
        if (routeLayerGroup) {
            map.removeLayer(routeLayerGroup);
        }

        // Create a new layer group for routes
        routeLayer = L.geoJSON(routeData, {
            style: function (feature) {
                return {
                    color: feature.properties.color,
                    weight: 4,
                    opacity: 0.8,
                };
            },
            onEachFeature: function (feature, layer) {
                layer.bindTooltip(feature.properties.route_name, {
                    permanent: false,
                    direction: "center",
                });
            },
        });

        // Create a layer group and add routes to it
        routeLayerGroup = L.layerGroup([routeLayer]);

        // Add routes to map first (background layer)
        routeLayerGroup.addTo(map);

        // Add a simple toggle button for routes
        const routeControl = L.Control.extend({
            onAdd: function (map) {
                const container = L.DomUtil.create(
                    "div",
                    "leaflet-bar leaflet-control"
                );
                const button = L.DomUtil.create(
                    "a",
                    "leaflet-control-zoom-in",
                    container
                );
                button.innerHTML = "🚇";
                button.title = "Toggle Transit Routes";
                button.style.width = "30px";
                button.style.height = "30px";
                button.style.textAlign = "center";
                button.style.lineHeight = "30px";

                let routesVisible = true;
                button.onclick = function () {
                    if (routesVisible) {
                        map.removeLayer(routeLayerGroup);
                        routesVisible = false;
                    } else {
                        // Remove and re-add all station markers to ensure they stay on top
                        const allMarkers = Object.values(stationMarkers);
                        allMarkers.forEach((marker) => map.removeLayer(marker));

                        // Add routes back
                        map.addLayer(routeLayerGroup);

                        // Re-add all station markers on top
                        allMarkers.forEach((marker) => map.addLayer(marker));

                        routesVisible = true;
                    }
                };

                return container;
            },
        });

        new routeControl({ position: "topright" }).addTo(map);

        console.log("Transit routes loaded and displayed.");
    } catch (error) {
        console.error("Error loading route data:", error);
    }
}

// Function to fetch and plot station data
async function plotStations() {
    try {
        const response = await fetch("stations_for_map.csv?t=" + Date.now());
        const data = await response.text();
        const rows = data.split("\n").slice(1);

        console.log(`Processing ${rows.length} station rows`);

        // Load routes first (so they appear behind stations)
        await loadRoutes(); // Load and display SkyTrain routes

        let processedCount = 0;
        let skippedCount = 0;

        rows.forEach((row, index) => {
            if (row.trim() === "") return; // Skip empty rows

            const cols = row.split(",");
            if (cols.length >= 4) {
                const stopNameRaw = cols[0];
                const lat = parseFloat(cols[1]);
                const lon = parseFloat(cols[2]);
                const line = cols[3].trim();
                const stationName = stopNameRaw.split(" @ ")[0];

                if (!isNaN(lat) && !isNaN(lon)) {
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
                    processedCount++;
                } else {
                    console.warn(
                        `Row ${index + 1}: Invalid coordinates - lat: ${
                            cols[1]
                        }, lon: ${cols[2]}`
                    );
                    skippedCount++;
                }
            } else {
                console.warn(
                    `Row ${
                        index + 1
                    }: Invalid format - expected 4 columns, got ${
                        cols.length
                    }: "${row}"`
                );
                skippedCount++;
            }
        });

        console.log(
            `Processed ${processedCount} valid rows, skipped ${skippedCount} rows`
        );
        console.log(
            `Processed ${Object.keys(stationData).length} unique stations`
        );

        // Log some examples of what we found
        const lineCounts = {};
        Object.values(stationData).forEach((station) => {
            station.platforms.forEach((platform) => {
                lineCounts[platform.line] =
                    (lineCounts[platform.line] || 0) + 1;
            });
        });
        console.log("Line breakdown:", lineCounts);

        // Group stops into stations using the new clustering system
        const allStops = [];
        Object.values(stationData).forEach((station) => {
            station.platforms.forEach((platform) => {
                allStops.push(platform);
            });
        });

        const clusteredStations = groupStopsIntoStations(allStops);
        console.log(
            `Grouped ${allStops.length} stops into ${clusteredStations.length} stations`
        );

        // Create markers for each clustered station
        clusteredStations.forEach((station) => {
            if (station.platforms.length > 0) {
                // Create a marker for each platform in the station
                station.platforms.forEach((platform) => {
                    addMarker(
                        platform.stopNameRaw,
                        platform.lat,
                        platform.lon,
                        platform.line,
                        station // Pass the station info for clustering
                    );
                });
            }
        });

        // --- Set initial view to fit all stations ---
        if (Object.keys(stationMarkers).length > 0) {
            const allMarkers = Object.values(stationMarkers);
            const featureGroup = L.featureGroup(allMarkers);
            const bounds = featureGroup.getBounds();
            map.fitBounds(bounds); // .pad(0.1) adds 10% padding
        } else {
            console.warn("No markers were created!");
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

function addMarker(stopName, lat, lon, line, stationInfo) {
    if (!isNaN(lat) && !isNaN(lon)) {
        const color = lineColors[line] || "#ff7800";

        const marker = L.circleMarker([lat, lon], {
            radius: 4, // Reduced from 5 for less cluttering
            fillColor: color,
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
        }).addTo(map);

        marker.options.originalColor = color;
        marker.options.stationInfo = stationInfo; // Store station clustering info

        // Bind a popup that gets its content from a function
        marker.bindPopup(() => getPopupContent(stopName), {
            minWidth: 280,
            maxWidth: 320,
        });

        // When a popup is opened, store its info
        marker.on("popupopen", () => {
            openPopupInfo = { marker, stopName };
        });

        stationMarkers[stopName] = marker;
        stationTrainCount[stopName] = 0;
    } else {
        console.warn(
            `Invalid coordinates for ${stopName}: lat=${lat}, lon=${lon}`
        );
    }
}

function updateMarkerPositions() {
    const zoom = map.getZoom();
    // Define max and min spread based on zoom - increased for better bus stop separation
    const maxSpread = 0.002; // Increased from 0.0011 for better separation
    const minZoom = 8; // Lowered from 10 to start spreading earlier
    const maxZoom = 17;
    let spread = maxSpread * ((maxZoom - zoom) / (maxZoom - minZoom));
    spread = Math.max(0, Math.min(maxSpread, spread));

    // Update marker sizes based on zoom
    updateMarkerSizes(zoom);

    // Group markers by their station info
    const stationGroups = {};
    Object.values(stationMarkers).forEach((marker) => {
        const stationInfo = marker.options.stationInfo;
        if (stationInfo && stationInfo.platforms.length > 1) {
            const stationKey = `${stationInfo.center.lat},${stationInfo.center.lon}`;
            if (!stationGroups[stationKey]) {
                stationGroups[stationKey] = [];
            }
            stationGroups[stationKey].push(marker);
        } else {
            // For markers without station info, keep them at their original position
            // This handles any legacy markers or single-stop stations
        }
    });

    // Apply spreading to grouped markers
    Object.values(stationGroups).forEach((markers) => {
        if (markers.length > 1) {
            const N = markers.length;
            markers.forEach((marker, index) => {
                const stationInfo = marker.options.stationInfo;

                if (spread > 0) {
                    // Spread out markers when zoomed out
                    const angle = ((2 * Math.PI) / N) * index;
                    const newLat =
                        stationInfo.center.lat + spread * Math.sin(angle);
                    const newLon =
                        stationInfo.center.lon +
                        (spread * Math.cos(angle)) /
                            Math.cos((stationInfo.center.lat * Math.PI) / 180);
                    marker.setLatLng([newLat, newLon]);
                } else {
                    // Return to exact position when zoomed in
                    const platform = stationInfo.platforms[index];
                    marker.setLatLng([platform.lat, platform.lon]);
                }
            });
        }
    });
}

function updateMarkerSizes(zoom) {
    // Adjust marker sizes based on zoom level
    let radius;
    if (zoom >= 15) {
        radius = 6; // Larger when very zoomed in
    } else if (zoom >= 12) {
        radius = 5; // Medium when moderately zoomed
    } else if (zoom >= 10) {
        radius = 4; // Smaller when zoomed out
    } else {
        radius = 3; // Very small when far out
    }

    Object.values(stationMarkers).forEach((marker) => {
        marker.setRadius(radius);
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

// Function to calculate distance between two coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Function to group nearby stops into stations
function groupStopsIntoStations(stops) {
    const CLUSTER_RADIUS = 50; // 50 meters - only group stops within this distance
    const stations = [];
    const processed = new Set();

    stops.forEach((stop, index) => {
        if (processed.has(index)) return;

        const station = {
            center: { lat: stop.lat, lon: stop.lon },
            platforms: [stop],
            name: stop.stopNameRaw.split(" @ ")[0],
        };

        // Find all stops within the cluster radius
        for (let i = index + 1; i < stops.length; i++) {
            if (processed.has(i)) continue;

            const distance = calculateDistance(
                stop.lat,
                stop.lon,
                stops[i].lat,
                stops[i].lon
            );

            if (distance <= CLUSTER_RADIUS) {
                station.platforms.push(stops[i]);
                processed.add(i);
            }
        }

        // Calculate center of the station
        if (station.platforms.length > 1) {
            const totalLat = station.platforms.reduce(
                (sum, p) => sum + p.lat,
                0
            );
            const totalLon = station.platforms.reduce(
                (sum, p) => sum + p.lon,
                0
            );
            station.center.lat = totalLat / station.platforms.length;
            station.center.lon = totalLon / station.platforms.length;
        }

        stations.push(station);
        processed.add(index);
    });

    return stations;
}

plotStations();
