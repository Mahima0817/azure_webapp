// =============================
// FRONTEND: app.js
// =============================

// Initialize Leaflet map centered around your campus
const map = L.map("map").setView([13.0827, 80.2707], 16);

// Add OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let campusData = null;
let nodes = [];
let edges = [];
let markers = [];
let routeLine = null;

// =============================
// 1️⃣ Fetch campus map data
// =============================
async function loadCampusData() {
  try {
    const response = await fetch("/campus_nodes_edges.json");
    if (!response.ok) throw new Error("Campus data not found");

    campusData = await response.json();
    nodes = campusData.nodes;
    edges = campusData.edges;

    populateDropdowns();
    placeMarkers();
    console.log("✅ Campus data loaded successfully.");
  } catch (error) {
    console.error("❌ Error loading campus data:", error);
    alert("Campus data not found. Please redeploy with campus_nodes_edges.json.");
  }
}

// =============================
// 2️⃣ Populate dropdowns with nodes
// =============================
function populateDropdowns() {
  const startSelect = document.getElementById("start");
  const endSelect = document.getElementById("end");

  nodes.forEach((node) => {
    const opt1 = document.createElement("option");
    opt1.value = node.id;
    opt1.textContent = node.name;

    const opt2 = document.createElement("option");
    opt2.value = node.id;
    opt2.textContent = node.name;

    startSelect.appendChild(opt1);
    endSelect.appendChild(opt2);
  });
}

// =============================
// 3️⃣ Place all campus markers
// =============================
function placeMarkers() {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  nodes.forEach((node) => {
    const marker = L.marker([node.lat, node.lng])
      .addTo(map)
      .bindPopup(`<b>${node.name}</b>`);
    markers.push(marker);
  });
}

// =============================
// 4️⃣ Draw path between two nodes
// =============================
function drawRoute(path) {
  if (routeLine) map.removeLayer(routeLine);
  const latlngs = path.map((id) => {
    const n = nodes.find((node) => node.id === id);
    return [n.lat, n.lng];
  });

  routeLine = L.polyline(latlngs, { color: "blue", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds());
}

// =============================
// 5️⃣ Handle "Find Route" button click
// =============================
document.getElementById("findRoute").addEventListener("click", async () => {
  const startId = document.getElementById("start").value;
  const endId = document.getElementById("end").value;
  const algorithm = document.getElementById("algorithm").value;
  const accessible = document.getElementById("accessible").checked;

  if (!startId || !endId) {
    alert("Please select both start and end locations!");
    return;
  }

  // Placeholder logic for now
  const path = [startId, endId]; // (You can replace this with Dijkstra/A* logic later)
  drawRoute(path);

  // Generate AI route explanation
  const startName = nodes.find((n) => n.id === startId)?.name;
  const endName = nodes.find((n) => n.id === endId)?.name;
  const routeSummary = `Generate step-by-step walking directions from ${startName} to ${endName} inside the campus using ${algorithm || "default"} algorithm. Accessible route: ${accessible}`;

  const routeText = await getGenAIResponse(routeSummary);
  document.getElementById("route-explanation").innerText = routeText;
});

// =============================
// 6️⃣ Get explanation from Azure OpenAI backend
// =============================
async function getGenAIResponse(prompt) {
  try {
    const response = await fetch("/api/genai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data.result || "No route explanation received.";
  } catch (error) {
    console.error("❌ AI route generation failed:", error);
    return "Error generating AI-based route explanation.";
  }
}

// =============================
// 7️⃣ Load data when page loads
// =============================
document.addEventListener("DOMContentLoaded", loadCampusData);



