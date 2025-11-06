// app.js – Location-based campus navigation with AI guidance

if (typeof window === "undefined" || typeof window.map === "undefined") {
  console.error("Map not found. Ensure index.html created window.map before app.js loads.");
}

const map = window.map;
const GRAPH_JSON = "/campus_nodes_edges.json";

let graph = {
  nodes: new Map(),
  adjacencyList: new Map(),
};

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

    // Draw static campus edges
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
    if (box) box.innerText = "Error loading campus data. Check console for details.";
  });

// ========== Utilities ==========
function countEdges(g) {
  let c = 0;
  for (const arr of g.adjacencyList.values()) c += arr.length;
  return c;
}

// Multiply weights to get realistic distances (1 unit = 150 meters)
function pathDistance(nodeIds) {
  let total = 0;
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const edges = graph.adjacencyList.get(nodeIds[i]) || [];
    const e = edges.find((x) => x.to === nodeIds[i + 1]);
    if (e) total += Number(e.weight || 1);
  }
  return total * 150; // scale to 150m per edge
}

// ========== Pathfinding Algorithms ==========
function bfs(graphObj, startId, endId, accessibleOnly = false) {
  if (startId === endId) return [startId];
  const q = [startId];
  const visited = new Set([startId]);
  const parent = new Map();

  while (q.length) {
    const u = q.shift();
    const neighbors = graphObj.adjacencyList.get(u) || [];
    for (const edge of neighbors) {
      if (accessibleOnly && !edge.accessible) continue;
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

function dijkstra(graphObj, startId, endId, accessibleOnly = false) {
  const dist = new Map();
  const prev = new Map();
  const pq = new MinHeap();

  for (const k of graphObj.nodes.keys()) dist.set(k, Infinity);
  dist.set(startId, 0);
  pq.push({ id: startId, d: 0 });

  while (!pq.isEmpty()) {
    const { id: u, d } = pq.pop();
    if (d > dist.get(u)) continue;
    if (u === endId) break;

    const neighbors = graphObj.adjacencyList.get(u) || [];
    for (const edge of neighbors) {
      if (accessibleOnly && !edge.accessible) continue;
      const v = edge.to;
      const alt = dist.get(u) + (Number(edge.weight) || 1);
      if (alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, u);
        pq.push({ id: v, d: alt });
      }
    }
  }

  const path = [];
  let cur = endId;
  while (cur !== undefined) {
    path.push(cur);
    cur = prev.get(cur);
  }
  return path.reverse();
}

class MinHeap {
  constructor() {
    this.items = [];
  }
  push(x) {
    this.items.push(x);
    this.bubbleUp(this.items.length - 1);
  }
  pop() {
    if (this.items.length === 0) return null;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top;
  }
  bubbleUp(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.items[p].d <= this.items[i].d) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }
  sinkDown(i) {
    const n = this.items.length;
    while (true) {
      let left = 2 * i + 1,
        right = 2 * i + 2,
        smallest = i;
      if (left < n && this.items[left].d < this.items[smallest].d) smallest = left;
      if (right < n && this.items[right].d < this.items[smallest].d) smallest = right;
      if (smallest === i) break;
      [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
      i = smallest;
    }
  }
  isEmpty() {
    return this.items.length === 0;
  }
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
      let path = [];
      if (algorithm === "bfs") path = bfs(graph, s, e);
      else if (algorithm === "dijkstra") path = dijkstra(graph, s, e);

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
  const filtered = readable.filter((v, i) => i === 0 || v !== readable[i - 1]);

  const routeSummary = `${filtered[0]} → ${filtered.slice(1, -1).join(" → ")} → ${filtered[filtered.length - 1]}`;

  // 🧭 Natural AI Prompt
  const prompt = `
You are a **friendly and intelligent campus navigation assistant** for Rajalakshmi Engineering College.

Your task is to write **location-based walking directions** between two places.

Guidelines:
- Focus on the start and destination only.
- Mention major blocks or landmarks along the way.
- Combine small hops into smooth sentences.
- Avoid "Walk from X to Y" lines — make it sound natural.
- Add turns or relative directions (left, right, straight).
- End with total distance (~${bestDist.toFixed(0)} meters) and estimated walking time (assume 1.4 m/s).

Route: ${routeSummary}
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
