// app.js – Final version: Natural, landmark-based AI navigation system

if (typeof window === "undefined" || typeof window.map === "undefined") {
  console.error("Map not found. Ensure index.html created window.map before app.js loads.");
}

const map = window.map;
const GRAPH_JSON = "/campus_nodes_edges.json";

let graph = { nodes: new Map(), adjacencyList: new Map() };
let nodesByName = {};
let currentPathLayer = null;

// ========== Graph Building ==========
function addNodeToGraph(node) {
  if (!graph.nodes.has(node.id)) {
    graph.nodes.set(node.id, node);
    graph.adjacencyList.set(node.id, []);
  }
}
function addEdgeToGraph(edge) {
  if (!graph.adjacencyList.has(edge.from)) return;
  graph.adjacencyList.get(edge.from).push({
    to: edge.to,
    weight: Number(edge.weight || 1),
    accessible: !!edge.accessible,
  });
}

// ========== Load Campus Data ==========
fetch(GRAPH_JSON)
  .then((r) => {
    if (!r.ok) throw new Error("Failed to load campus_nodes_edges.json.");
    return r.json();
  })
  .then((data) => {
    (data.nodes || []).forEach((n) => addNodeToGraph(n));
    (data.edges || []).forEach((e) => addEdgeToGraph(e));

    nodesByName = {};
    for (const node of graph.nodes.values()) {
      const name = (node.name || "Unnamed").trim();
      if (!nodesByName[name]) nodesByName[name] = [];
      nodesByName[name].push(node);
    }

    const locationMarkers = Object.entries(nodesByName).map(([name, arr]) => {
      const avgLat = arr.reduce((s, a) => s + a.lat, 0) / arr.length;
      const avgLng = arr.reduce((s, a) => s + a.lng, 0) / arr.length;
      return { name, lat: avgLat, lng: avgLng };
    });

    locationMarkers.forEach((loc) =>
      L.marker([loc.lat, loc.lng]).addTo(map).bindPopup(`<b>${loc.name}</b>`)
    );

    // Draw campus connections
    for (const [fromId, edges] of graph.adjacencyList.entries()) {
      const fromNode = graph.nodes.get(fromId);
      if (!fromNode) continue;
      edges.forEach((edge) => {
        const toNode = graph.nodes.get(edge.to);
        if (!toNode) return;
        L.polyline([[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]], {
          color: "#aaa",
          weight: 1,
        }).addTo(map);
      });
    }

    // Dropdowns
    const startSelect = document.getElementById("start");
    const endSelect = document.getElementById("end");
    locationMarkers.sort((a, b) => a.name.localeCompare(b.name)).forEach((loc) => {
      const op1 = document.createElement("option");
      op1.value = loc.name;
      op1.textContent = loc.name;
      startSelect.appendChild(op1);

      const op2 = document.createElement("option");
      op2.value = loc.name;
      op2.textContent = loc.name;
      endSelect.appendChild(op2);
    });

    console.log("✅ Campus data loaded:", graph.nodes.size, "nodes,", countEdges(graph), "edges.");
  })
  .catch((err) => {
    console.error("Error loading campus graph:", err);
    const box = document.getElementById("routeExplanation");
    if (box) box.innerText = "Error loading campus data.";
  });

// ========== Utilities ==========
function countEdges(g) {
  let c = 0;
  for (const arr of g.adjacencyList.values()) c += arr.length;
  return c;
}

function pathDistance(nodeIds) {
  let total = 0;
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const edges = graph.adjacencyList.get(nodeIds[i]) || [];
    const e = edges.find((x) => x.to === nodeIds[i + 1]);
    if (e) total += Number(e.weight || 1);
  }
  return total * 150; // 1 weight = 150 meters
}

// ========== Algorithms ==========
function bfs(graphObj, startId, endId) {
  if (startId === endId) return [startId];
  const q = [startId];
  const visited = new Set([startId]);
  const parent = new Map();

  while (q.length) {
    const u = q.shift();
    const neighbors = graphObj.adjacencyList.get(u) || [];
    for (const edge of neighbors) {
      const v = edge.to;
      if (!visited.has(v)) {
        visited.add(v);
        parent.set(v, u);
        if (v === endId) {
          const path = [];
          let cur = v;
          while (cur !== undefined) {
            path.push(cur);
            cur = parent.get(cur);
          }
          return path.reverse();
        }
        q.push(v);
      }
    }
  }
  return [];
}

// ========== Draw Path ==========
function drawPath(nodeIds) {
  if (currentPathLayer) map.removeLayer(currentPathLayer);
  const latlngs = nodeIds
    .map((id) => {
      const n = graph.nodes.get(id);
      return n ? [n.lat, n.lng] : null;
    })
    .filter(Boolean);
  currentPathLayer = L.polyline(latlngs, { color: "red", weight: 4 }).addTo(map);
  try {
    map.fitBounds(currentPathLayer.getBounds(), { padding: [40, 40] });
  } catch (e) {}
}

// ========== Route Finder ==========
document.getElementById("findRoute").addEventListener("click", async () => {
  const startName = document.getElementById("start").value;
  const endName = document.getElementById("end").value;
  const algorithm = document.getElementById("algorithm").value || "bfs";

  if (!startName || !endName) return alert("Please select both start and end.");
  if (!nodesByName[startName] || !nodesByName[endName]) return alert("Invalid location.");
  if (startName === endName) return alert("Start and end are the same.");

  const startIds = nodesByName[startName].map((n) => n.id);
  const endIds = nodesByName[endName].map((n) => n.id);

  let bestPath = null;
  let bestDist = Infinity;

  for (const s of startIds) {
    for (const e of endIds) {
      const path = bfs(graph, s, e);
      if (path && path.length > 0) {
        const d = pathDistance(path);
        if (d < bestDist) {
          bestDist = d;
          bestPath = path;
        }
      }
    }
  }

  if (!bestPath) return alert("No path found.");

  drawPath(bestPath);

  const readable = bestPath.map((id) => graph.nodes.get(id)?.name || id);
  let filtered = readable.filter((v, i) => i === 0 || v !== readable[i - 1]);

  // 🚫 Remove purely numeric nodes like "26", "27"
  filtered = filtered.filter((name) => isNaN(name));

  const routeSummary = `${filtered[0]} → ${filtered.slice(1, -1).join(" → ")} → ${filtered[filtered.length - 1]}`;

  // ✨ AI Prompt - landmark-based only
  const prompt = `
You are a **smart campus navigation assistant** for Rajalakshmi Engineering College.

Your goal is to give natural walking directions between campus landmarks.

🧭 Guidelines:
- Focus only on major named locations (ignore numeric buildings like 26, 27, etc.).
- Use natural navigation phrases like “walk straight”, “turn left”, “head past”.
- Mention any landmarks or notable spots on the way.
- Avoid robotic step-by-step sentences like “Walk from X to Y”.
- Write 4–6 friendly sentences describing the route.
- End with total distance (~${bestDist.toFixed(0)} meters) and approximate walking time.

Route Summary: ${routeSummary}
`;

  const aiText = await fetchAI(prompt);

  const box = document.getElementById("routeExplanation");
  box.innerHTML = `
    <div style="font-family:Poppins,Arial;padding:12px;background:#f7faff;border-radius:10px;border-left:4px solid #0a66c2;">
      <h3 style="color:#083d77;margin:0 0 8px 0;">🚶 AI Navigation Guide</h3>
      <p style="margin-top:10px;background:#fff;padding:12px;border-left:4px solid #4da6ff;line-height:1.6;">
        ${aiText}
      </p>
      <p style="margin-top:8px;color:#004d99;font-weight:600;">
        📏 Total Distance: ~${bestDist.toFixed(0)} meters
      </p>
    </div>
  `;
});

// ========== Backend API ==========
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://azurewebapp-ata8ehd9d8c8hjgv.southindia-01.azurewebsites.net";

async function fetchAI(prompt) {
  try {
    const res = await fetch(`${API_BASE}/api/genai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("AI call failed:", res.status, err);
      return "AI explanation unavailable.";
    }

    const data = await res.json();
    return data.result || "No AI response.";
  } catch (e) {
    console.error("AI fetch error:", e);
    return "Error fetching AI explanation.";
  }
}

