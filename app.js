// ===========================
// 🌍 SMART CAMPUS NAVIGATOR
// ===========================

(function() {
  // FIX: Ensure Leaflet map container is reset if already initialized
  if (L.DomUtil.get('map') != null) {
    L.DomUtil.get('map')._leaflet_id = null;
  }

  // Now safely initialize your map WITHOUT redeclaring it elsewhere
  let map = L.map("map").setView([13.0827, 80.2707], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // ===========================
  // 🧠 GRAPH DATA STRUCTURE
  // ===========================
  const graph = {
    nodes: new Map(),
    adjacencyList: new Map(),
    addNode(node) {
      if (!this.nodes.has(node.id)) {
        this.nodes.set(node.id, node);
        this.adjacencyList.set(node.id, []);
      }
    },
    addEdge(edge) {
      if (this.adjacencyList.has(edge.from)) {
        this.adjacencyList.get(edge.from).push({
          to: edge.to,
          weight: edge.weight,
          accessible: edge.accessible,
        });
      }
    },
  };

  // ===========================
  // 📥 LOAD CAMPUS DATA
  // ===========================
  fetch("campus_nodes_edges.json")
    .then((response) => {
      if (!response.ok) throw new Error("Campus data not found (404)");
      return response.json();
    })
    .then((data) => {
      // Add nodes & edges to graph
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
      const locationMarkers = Object.entries(nodesByName).map(([name, nodes]) => {
        const avgLat = nodes.reduce((sum, n) => sum + n.lat, 0) / nodes.length;
        const avgLng = nodes.reduce((sum, n) => sum + n.lng, 0) / nodes.length;
        return { name, lat: avgLat, lng: avgLng };
      });

      // Add map markers
      locationMarkers.forEach((loc) => {
        L.marker([loc.lat, loc.lng]).bindPopup(loc.name).addTo(map);
      });

      // Populate dropdowns
      const startSelect = document.getElementById("start");
      const endSelect = document.getElementById("end");
      locationMarkers.forEach((loc) => {
        const opt1 = document.createElement("option");
        opt1.value = loc.name;
        opt1.text = loc.name;
        startSelect.add(opt1);

        const opt2 = document.createElement("option");
        opt2.value = loc.name;
        opt2.text = loc.name;
        endSelect.add(opt2);
      });

      // Draw gray static edges
      data.edges.forEach((edge) => {
        const fromNode = graph.nodes.get(edge.from);
        const toNode = graph.nodes.get(edge.to);
        if (fromNode && toNode) {
          L.polyline(
            [
              [fromNode.lat, fromNode.lng],
              [toNode.lat, toNode.lng],
            ],
            { color: "gray", weight: 1 }
          ).addTo(map);
        }
      });

      // ===========================
      // 🚀 FIND ROUTE HANDLER
      // ===========================
      document.getElementById("findRoute").addEventListener("click", async () => {
        const startName = startSelect.value;
        const endName = endSelect.value;
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

        const startNodeIds = nodesByName[startName].map((n) => n.id);
        const endNodeIds = nodesByName[endName].map((n) => n.id);

        let shortestPath = null;
        let shortestDistance = Infinity;

        for (const sId of startNodeIds) {
          for (const eId of endNodeIds) {
            let path = [];
            switch (algorithm.toLowerCase()) {
              case "bfs":
                path = bfs(graph, sId, eId);
                break;
              case "dfs":
                path = dfs(graph, sId, eId);
                break;
              case "dijkstra":
                path = dijkstra(graph, sId, eId, "distance", accessibility);
                break;
              default:
                alert("Please select an algorithm.");
                return;
            }

            if (path && path.length > 0) {
              const totalDist = calculatePathDistance(path);
              if (totalDist < shortestDistance) {
                shortestDistance = totalDist;
                shortestPath = path;
              }
            }
          }
        }

        if (!shortestPath) {
          alert("No path found between the selected locations.");
          return;
        }

        drawPath(shortestPath);

        // Convert node IDs → readable names
        const locationPath = shortestPath
          .map((id) => {
            const node = graph.nodes.get(id);
            return node && node.name && !node.name.toLowerCase().includes("node")
              ? node.name
              : null;
          })
          .filter((n) => n);

        const filtered = locationPath.filter(
          (loc, i) => i === 0 || loc !== locationPath[i - 1]
        );

        const readableSteps = filtered
          .map(
            (loc, i) =>
              i < filtered.length - 1 &&
              `Walk from <strong>${loc}</strong> to <strong>${filtered[i + 1]}</strong>.`
          )
          .filter(Boolean);

        const prompt = `
          Generate short, clear, human-like walking directions for the following route:
          ${filtered.join(" → ")}.
          Avoid "node" or "unnamed" terms.
          Total walking distance: ${shortestDistance.toFixed(2)} meters.
        `;

        const aiExplanation = await getRouteExplanation(prompt);

        const box = document.getElementById("routeExplanation");
        box.innerHTML = `
          <div style="font-family:Poppins,Arial;padding:12px;background:#f7faff;border-radius:10px;border-left:5px solid #0066cc;">
            <h3 style="color:#004d99;">🚶 Step-by-Step Directions</h3>
            <ol style="margin-left:20px;line-height:1.6;color:#333;">
              ${readableSteps.map((s) => `<li>${s}</li>`).join("")}
            </ol>
            <p style="margin-top:12px;background:#fff;padding:10px;border-left:4px solid #4da6ff;">
              <strong>AI Guidance:</strong> ${aiExplanation}
            </p>
            <p style="margin-top:8px;color:#004d99;font-weight:600;">
              📏 Total Distance: ${shortestDistance.toFixed(2)} meters
            </p>
          </div>`;
      });
    })
    .catch((err) => console.error("❌ Error loading campus data:", err));

  // ===========================
  // 📏 CALCULATE PATH DISTANCE
  // ===========================
  function calculatePathDistance(path) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const edges = graph.adjacencyList.get(path[i]) || [];
      const edge = edges.find((e) => e.to === path[i + 1]);
      if (edge) total += edge.weight;
    }
    return total;
  }

  // ===========================
  // 🗺️ DRAW PATH
  // ===========================
  let currentPathLayer = null;
  function drawPath(nodeIds) {
    if (currentPathLayer) map.removeLayer(currentPathLayer);
    const latlngs = nodeIds.map((id) => {
      const node = graph.nodes.get(id);
      return [node.lat, node.lng];
    });
    currentPathLayer = L.polyline(latlngs, { color: "red", weight: 4 }).addTo(map);
    map.fitBounds(currentPathLayer.getBounds());
  }

  // ===========================
  // 🤖 AI ROUTE EXPLANATION
  // ===========================
  async function getRouteExplanation(prompt) {
    try {
      const res = await fetch("/api/genai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      return data.result || "No AI explanation available.";
    } catch (e) {
      console.error("AI explanation error:", e);
      return "Error fetching AI explanation.";
    }
  }

  // Your bfs, dfs, and dijkstra functions should be defined here as well

})();
