const map = L.map("map").setView([49.2827, -123.1207], 10); // Centered on Vancouver, wider zoom

// Define base layers
const streetMap = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
    }
);

const satelliteMap = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        maxZoom: 19,
        attribution:
            "© Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    }
);

// Dark mode map perfect for dark theme
const darkMap = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "© CartoDB, © OpenStreetMap contributors",
    }
);

// Light minimalist style
const lightMap = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    {
        maxZoom: 19,
        attribution: "© CartoDB, © OpenStreetMap contributors",
    }
);

// Terrain map
const terrainMap = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 17,
        attribution: "© OpenTopoMap contributors",
    }
);

// Add default layer (street map)
streetMap.addTo(map);

// Current map mode tracking
let currentMapType = "street";
let currentBaseLayer = streetMap;

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
let locationMarker = null; // To keep track of the user's location marker

const lineColors = {
    // SkyTrain lines
    "Canada Line": "#009ac7",
    "Expo Line": "#005DAB",
    "Millennium Line": "#E1B903",

    // RapidBus lines - individual names but same color
    "R1 King George Blvd": "#009f4a",
    "R2 Marine Dr": "#009f4a",
    "R3 Lougheed Hwy": "#009f4a",
    "R4 41st Ave": "#009f4a",
    "R5 Hastings St": "#009f4a",
    "R6 Scott Rd": "#009f4a",

    // 99 B-Line
    "99 B-Line": "#f37a22",

    // SeaBus
    SeaBus: "#87746b",
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
    "99 B-Line": "#FFD300", // Bright Orange

    // SeaBus
    SeaBus: "#ffcc99", // Light Brown
};

// ===== UI STATE MANAGEMENT =====
let isAppLoaded = false;
let currentTheme = localStorage.getItem("theme") || "light";
let routesVisible = true;
let locationVisible = false;

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", function () {
    initializeUI();
    initializeMap();
    loadAppData();
});

// ===== UI INITIALIZATION =====
function initializeUI() {
    // Set initial theme
    document.documentElement.setAttribute("data-theme", currentTheme);
    updateThemeIcon();

    // Theme toggle
    const themeToggle = document.getElementById("theme-toggle");
    themeToggle.addEventListener("click", toggleTheme);

    // Info modal
    const infoToggle = document.getElementById("info-toggle");
    const infoModal = document.getElementById("info-modal");
    const modalClose = document.querySelector(".modal-close");

    infoToggle.addEventListener("click", () => {
        infoModal.classList.add("active");
    });

    modalClose.addEventListener("click", () => {
        infoModal.classList.remove("active");
    });

    infoModal.addEventListener("click", (e) => {
        if (e.target === infoModal) {
            infoModal.classList.remove("active");
        }
    });

    // Legend toggle
    const legendToggle = document.querySelector(".legend-toggle");
    const legend = document.getElementById("legend");

    legendToggle.addEventListener("click", () => {
        legend.classList.toggle("collapsed");
        legendToggle.textContent = legend.classList.contains("collapsed")
            ? "+"
            : "−";
    });

    // Map controls
    setupMapControls();

    // Update status
    updateStatus("Initializing...", "loading");

    console.log("UI initialized");
}

function initializeMap() {
    // Map initialization will be done in the existing code below
    console.log("Map initialization started");
}

function toggleTheme() {
    currentTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("theme", currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeIcon = document.querySelector(".theme-icon");
    themeIcon.textContent = currentTheme === "light" ? "🌙" : "☀️";
}

function setupMapControls() {
    // Route toggle (will integrate with existing route functionality)
    const routeToggle = document.getElementById("route-toggle");
    routeToggle.addEventListener("click", toggleRoutes);

    // Map type selector
    const mapSelector = document.getElementById("map-selector");
    mapSelector.addEventListener("change", changeMapType);

    // Location button
    const locateBtn = document.getElementById("locate-btn");
    locateBtn.addEventListener("click", toggleLocation);

    // Fullscreen button
    const fullscreenBtn = document.getElementById("fullscreen-btn");
    fullscreenBtn.addEventListener("click", toggleFullscreen);
}

function toggleRoutes() {
    if (routeLayerGroup) {
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

        const routeToggle = document.getElementById("route-toggle");
        routeToggle.classList.toggle("active", routesVisible);
    }
}

function changeMapType() {
    const mapSelector = document.getElementById("map-selector");
    const selectedType = mapSelector.value;

    // Remove current base layer
    map.removeLayer(currentBaseLayer);

    // Add selected layer
    switch (selectedType) {
        case "street":
            currentBaseLayer = streetMap;
            currentMapType = "street";
            break;
        case "satellite":
            currentBaseLayer = satelliteMap;
            currentMapType = "satellite";
            break;
        case "dark":
            currentBaseLayer = darkMap;
            currentMapType = "dark";
            break;
        case "light":
            currentBaseLayer = lightMap;
            currentMapType = "light";
            break;
        case "terrain":
            currentBaseLayer = terrainMap;
            currentMapType = "terrain";
            break;
        default:
            currentBaseLayer = streetMap;
            currentMapType = "street";
    }

    map.addLayer(currentBaseLayer);
}

function toggleLocation() {
    const locateBtn = document.getElementById("locate-btn");

    if (locationVisible) {
        // Hide location marker
        if (locationMarker) {
            map.removeLayer(locationMarker);
            locationMarker = null;
        }
        locationVisible = false;
        locateBtn.classList.remove("active");
        locateBtn.title = "Show My Location";
    } else {
        // Show location marker
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    if (locationMarker) {
                        locationMarker.setLatLng([lat, lng]);
                    } else {
                        locationMarker = L.circleMarker([lat, lng], {
                            radius: 8,
                            fillColor: "#4a86e8",
                            color: "#ffffff",
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.9,
                        })
                            .addTo(map)
                            .bindPopup("Your Location");
                    }

                    map.setView([lat, lng], 15);
                    locationMarker.openPopup();
                    locationVisible = true;
                    locateBtn.classList.add("active");
                    locateBtn.title = "Hide My Location";
                },
                (error) => {
                    updateStatus("Location access denied", "error");
                    setTimeout(() => updateStatus("Live", "success"), 3000);
                }
            );
        } else {
            updateStatus("Geolocation not supported", "error");
            setTimeout(() => updateStatus("Live", "success"), 3000);
        }
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.log("Fullscreen error:", err);
        });
    } else {
        document.exitFullscreen();
    }
}

function updateStatus(message, type = "success") {
    const statusText = document.getElementById("status-text");
    const statusIndicator = document.getElementById("connection-status");

    statusText.textContent = message;
    statusIndicator.className = `status-indicator ${type}`;
}

function updateLastUpdated() {
    const lastUpdated = document.getElementById("last-updated");
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
    lastUpdated.innerHTML = `<span>🕐</span><span>${timeString}</span>`;
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById("loading-screen");
    const app = document.getElementById("app");

    setTimeout(() => {
        loadingScreen.style.opacity = "0";
        setTimeout(() => {
            loadingScreen.style.display = "none";
            app.classList.add("loaded");
            isAppLoaded = true;
            updateStatus("Live", "success");
            updateLastUpdated();
        }, 500);
    }, 1000); // Show loading for at least 1 second
}

async function loadAppData() {
    try {
        updateStatus("Loading routes...", "loading");
        await loadRoutes();

        updateStatus("Loading stations...", "loading");
        await loadStations();

        updateStatus("Loading schedules...", "loading");
        await loadSchedules();

        updateStatus("Starting real-time updates...", "loading");
        startRealTimeUpdates();

        hideLoadingScreen();
    } catch (error) {
        console.error("Error loading app data:", error);
        updateStatus("Failed to load data", "error");
        setTimeout(() => {
            updateStatus("Retrying...", "loading");
            loadAppData();
        }, 5000);
    }
}

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

        console.log("Transit routes loaded and displayed.");
    } catch (error) {
        console.error("Error loading route data:", error);
        throw error;
    }
}

// Function to fetch and plot station data
async function loadStations() {
    try {
        const response = await fetch("stations_for_map.csv?t=" + Date.now());
        const data = await response.text();
        const rows = data.split("\n").slice(1);

        console.log(`Processing ${rows.length} station rows`);

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

        console.log("Stations loaded successfully");
    } catch (error) {
        console.error("Error fetching or parsing station data:", error);
        throw error;
    }
}

// Wrapper function for loading schedules
async function loadSchedules() {
    try {
        await loadJourneys();
        await loadStationSchedules();
        console.log("Schedules loaded successfully");
    } catch (error) {
        console.error("Error loading schedules:", error);
        throw error;
    }
}

// Wrapper function for starting real-time updates
function startRealTimeUpdates() {
    try {
        startTrainTracker();
        console.log("Real-time updates started");

        // Update the last updated time every minute
        setInterval(updateLastUpdated, 60000);
    } catch (error) {
        console.error("Error starting real-time updates:", error);
        throw error;
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
        // Determine the vehicle type based on the line information
        const vehicleType = getVehicleTypeForStop(stopName);
        content += `No more ${vehicleType} today.`;
    } else {
        upcomingArrivals.forEach((arrival) => {
            const diffSeconds = arrival.time - secondsToday;
            const arrivalText = formatCountdown(diffSeconds);
            content += `- ${arrival.direction} (${arrivalText})<br>`;
        });
    }

    return content;
}

function getVehicleTypeForStop(stopName) {
    // Find the line for this stop from stationData
    for (const [stationName, stationInfo] of Object.entries(stationData)) {
        for (const platform of stationInfo.platforms) {
            if (platform.stopNameRaw === stopName) {
                const line = platform.line;

                // Determine vehicle type based on line
                if (
                    line === "Canada Line" ||
                    line === "Expo Line" ||
                    line === "Millennium Line"
                ) {
                    return "trains";
                } else if (line.startsWith("R") && line.includes(" ")) {
                    // RapidBus lines (R1, R2, R3, R4, R5, R6)
                    return "buses";
                } else if (line === "99 B-Line") {
                    return "buses";
                } else if (line === "SeaBus") {
                    return "seabuses";
                } else {
                    // Default fallback
                    return "vehicles";
                }
            }
        }
    }

    // Fallback if no line information found
    return "vehicles";
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

// ===== PWA AND CONNECTIVITY FEATURES =====
let isOnline = navigator.onLine;
let updateAvailable = false;

// Check for service worker updates
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (updateAvailable) {
            showUpdateNotification();
        }
    });

    navigator.serviceWorker.ready.then((registration) => {
        registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            newWorker.addEventListener("statechange", () => {
                if (
                    newWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                ) {
                    updateAvailable = true;
                    showUpdateNotification();
                }
            });
        });
    });
}

// Online/offline status
window.addEventListener("online", () => {
    isOnline = true;
    updateStatus("Connected", "success");
    hideOfflineNotification();
});

window.addEventListener("offline", () => {
    isOnline = false;
    updateStatus("Offline", "error");
    showOfflineNotification();
});

function showUpdateNotification() {
    const notification = document.createElement("div");
    notification.className = "update-notification";
    notification.innerHTML = `
        <div class="notification-content">
            <span>🔄</span>
            <span>New version available!</span>
            <button onclick="refreshApp()">Update</button>
            <button onclick="dismissNotification(this.parentElement.parentElement)">Later</button>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
    }, 100);
}

function showOfflineNotification() {
    if (document.querySelector(".offline-notification")) return;

    const notification = document.createElement("div");
    notification.className = "offline-notification";
    notification.innerHTML = `
        <div class="notification-content">
            <span>📶</span>
            <span>You're currently offline. Some features may be limited.</span>
        </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
    }, 100);
}

function hideOfflineNotification() {
    const notification = document.querySelector(".offline-notification");
    if (notification) {
        notification.classList.remove("show");
        setTimeout(() => {
            if (notification.parentElement) {
                notification.parentElement.removeChild(notification);
            }
        }, 300);
    }
}

function refreshApp() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        });
    }
    location.reload();
}

function dismissNotification(notification) {
    notification.classList.remove("show");
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}

// ===== EXISTING UI CODE CONTINUES =====
