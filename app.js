// Fetch data and initialize graph
fetch("campus_nodes_edges.json")
  .then((response) => response.json())
  .then((data) => {
    data.nodes.forEach((node) => graph.addNode(node));
    data.edges.forEach((edge) => graph.addEdge(edge));

    // Group nodes by location name
    const nodesByName = {};
    data.nodes.forEach((node) => {
      if (node.name && node.name.trim() !== "") {
        const name = node.name.trim();
        if (!nodesByName[name]) nodesByName[name] = [];
        nodesByName[name].push(node);
      }
    });

    // Calculate average lat/lng for each location
    const locationMarkers = [];
    for (const name in nodesByName) {
      const nodes = nodesByName[name];
      const avgLat = nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length;
      const avgLng = nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length;
      locationMarkers.push({ name, lat: avgLat, lng: avgLng });
    }

    // Add map markers
    locationMarkers.forEach((location) => {
      L.marker([location.lat, location.lng]).bindPopup(location.name).addTo(map);
    });

    // Populate dropdowns
    const startSelect = document.getElementById("start");
    const endSelect = document.getElementById("end");
    locationMarkers.forEach((location) => {
      const option = document.createElement("option");
      option.value = location.name;
      option.text = location.name;
      startSelect.add(option.cloneNode(true));
      endSelect.add(option);
    });

    // Draw static map edges
    data.edges.forEach((edge) => {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      const latlngs = [
        [fromNode.lat, fromNode.lng],
        [toNode.lat, toNode.lng],
      ];
      L.polyline(latlngs, { color: "gray" }).addTo(map);
    });

    // Handle route finding
    document.getElementById("findRoute").addEventListener("click", async () => {
      const startName = document.getElementById("start").value;
      const endName = document.getElementById("end").value;
      const algorithm = document.getElementById("algorithm").value;
      const accessibility = document.getElementById("accessibility").checked;

      if (!startName || !endName) {
        alert("Please select both start and end locations.");
        return;
      }

      if (startName === endName) {
        alert("Start and end locations cannot be the same.");
        return;
      }

      const startNodeIds = nodesByName[startName].map((node) => node.id);
      const endNodeIds = nodesByName[endName].map((node) => node.id);

      let shortestPath = null;
      let shortestDistance = Infinity;

      // Run the chosen algorithm
      for (const startId of startNodeIds) {
        for (const endId of endNodeIds) {
          let path = [];
          switch (algorithm.toLowerCase()) {
            case "bfs":
              path = bfs(graph, startId, endId);
              break;
            case "dfs":
              path = dfs(graph, startId, endId);
              break;
            case "dijkstra":
              path = dijkstra(graph, startId, endId, "distance", accessibility);
              break;
          }

          if (path.length > 0) {
            const totalDistance = calculatePathDistance(path);
            if (totalDistance < shortestDistance) {
              shortestDistance = totalDistance;
              shortestPath = path;
            }
          }
        }
      }

      if (shortestPath) {
        drawPath(shortestPath);

        // ✅ Convert node IDs to readable location names (ignore unnamed)
        const locationPath = shortestPath
          .map((id) => {
            const node = graph.nodes.get(id);
            return node.name && !node.name.toLowerCase().includes("node")
              ? node.name
              : null; // Skip unnamed nodes
          })
          .filter((name) => name !== null);

        // ✅ Avoid repeated consecutive locations
        const filteredLocations = locationPath.filter(
          (loc, i) => i === 0 || loc !== locationPath[i - 1]
        );

        // ✅ Build step-by-step directions
        const readableDirections = [];
        for (let i = 0; i < filteredLocations.length - 1; i++) {
          readableDirections.push(
            `Walk from <strong>${filteredLocations[i]}</strong> to <strong>${filteredLocations[i + 1]}</strong>.`
          );
        }

        // ✅ AI-friendly explanation prompt
        const explanationPrompt = `
          Generate natural, human-like campus walking directions.
          The route includes: ${filteredLocations.join(" → ")}.
          Write clear, short step-by-step instructions suitable for a student walking across campus.
          Avoid any mention of "Node" or "Unnamed" points.
          Total walking distance: ${shortestDistance.toFixed(2)} meters.
        `;

        // ✅ Get AI explanation
        const explanation = await getRouteExplanation(explanationPrompt);

        // ✅ Display directions in clean, readable format
        const explanationBox = document.getElementById("routeExplanation");
        explanationBox.innerHTML = `
          <div style="font-family: Poppins, Arial; padding: 12px; background: #f7faff; border-radius: 10px; border-left: 5px solid #0066cc;">
            <h3 style="color: #004d99;">🚶 Step-by-Step Directions</h3>
            <ol style="margin-left: 20px; line-height: 1.6; color: #333;">
              ${readableDirections.map((step) => `<li>${step}</li>`).join("")}
            </ol>
            <p style="margin-top: 12px; background: #ffffff; padding: 10px; border-left: 4px solid #4da6ff;">
              <strong>AI Guidance:</strong> ${explanation}
            </p>
            <p style="margin-top: 8px; color: #004d99; font-weight: 600;">
              📏 Total Distance: ${shortestDistance.toFixed(2)} meters
            </p>
          </div>
        `;
      } else {
        alert("No path found between the selected locations.");
      }
    });
  })
  .catch((error) => console.error("Error loading campus data:", error));

// Calculate path distance
function calculatePathDistance(path) {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const fromNodeId = path[i];
    const toNodeId = path[i + 1];
    const edges = graph.adjacencyList.get(fromNodeId);
    const edge = edges.find((e) => e.to === toNodeId);
    if (edge) totalDistance += edge.weight;
  }
  return totalDistance;
}

// Draw red path on map
let currentPathLayer;
function drawPath(nodeIds) {
  if (currentPathLayer) {
    map.removeLayer(currentPathLayer);
  }
  const latlngs = nodeIds.map((nodeId) => {
    const node = graph.nodes.get(nodeId);
    return [node.lat, node.lng];
  });
  currentPathLayer = L.polyline(latlngs, { color: "red", weight: 4 }).addTo(map);
  map.fitBounds(currentPathLayer.getBounds());
}

// Fetch AI route explanation
async function getRouteExplanation(prompt) {
  try {
    const response = await fetch("/api/genai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    return data.result || "No AI explanation available.";
  } catch (err) {
    console.error("AI route explanation error:", err);
    return "Error fetching AI explanation.";
  }
}
