// app.js - frontend logic: load graph, populate dropdowns, BFS/DFS/Dijkstra, draw path, call /api/genai

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

// ========== Build Graph ==========
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

// ========== Load Graph ==========
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

    console.log("Campus data loaded:", graph.nodes.size, "nodes,", countEdges(graph), "edges.");
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

function pathDistance(nodeIds) {
  let total = 0;
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const edges = graph.adjacencyList.get(nodeIds[i]) || [];
    const e = edges.find((x) => x.to === nodeIds[i + 1]);
    if (e) total += Number(e.weight || 1);
  }
  return total;
}

// ========== Algorithms ==========
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

function dfs(graphObj, startId, endId, accessibleOnly = false) {
  const stack = [startId];
  const parent = new Map();
  const visited = new Set([startId]);

  while (stack.length) {
    const u = stack.pop();
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
        stack.push(v);
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

  if (!prev.has(endId) && startId !== endId && dist.get(endId) === Infinity) return [];
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
  bubbleUp(idx) {
    while (idx > 0) {
      const p = Math.floor((idx - 1) / 2);
      if (this.items[p].d <= this.items[idx].d) break;
      [this.items[p], this.items[idx]] = [this.items[idx], this.items[p]];
      idx = p;
    }
  }
  sinkDown(idx) {
    const n = this.items.length;
    while (true) {
      let left = 2 * idx + 1,
        right = 2 * idx + 2,
        smallest = idx;
      if (left < n && this.items[left].d < this.items[smallest].d) smallest = left;
      if (right < n && this.items[right].d < this.items[smallest].d) smallest = right;
      if (smallest === idx) break;
      [this.items[smallest], this.items[idx]] = [this.items[idx], this.items[smallest]];
      idx = smallest;
    }
  }
  isEmpty() {
    return this.items.length === 0;
  }
}

// ========== Draw Path ==========
function drawPath(nodeIds) {
  if (!nodeIds || nodeIds.length === 0) {
    alert("No path to draw.");
    return;
  }
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
  const accessibleOnly = document.getElementById("accessibility").checked;

  if (!startName || !endName) {
    alert("Please select both start and end.");
    return;
  }
  if (!nodesByName[startName] || !nodesByName[endName]) {
    alert("Selected locations not found.");
    return;
  }
  if (startName === endName) {
    alert("Start and end are the same.");
    return;
  }

  const startIds = nodesByName[startName].map((n) => n.id);
  const endIds = nodesByName[endName].map((n) => n.id);

  let bestPath = null;
  let bestDist = Infinity;

  for (const s of startIds) {
    for (const e of endIds) {
      let path = [];
      if (algorithm === "bfs") path = bfs(graph, s, e, accessibleOnly);
      else if (algorithm === "dfs") path = dfs(graph, s, e, accessibleOnly);
      else if (algorithm === "dijkstra") path = dijkstra(graph, s, e, accessibleOnly);
      if (path && path.length > 0) {
        const d = pathDistance(path);
        if (d < bestDist) {
          bestDist = d;
          bestPath = path;
        }
      }
    }
  }

  if (!bestPath) {
    alert("No path found between the selected locations.");
    return;
  }

  drawPath(bestPath);

  const readable = bestPath.map((id) => graph.nodes.get(id)?.name || id).filter(Boolean);
  const filtered = readable.filter((v, i) => i === 0 || v !== readable[i - 1]);

  const steps = filtered
    .map((loc, idx) => {
      if (idx === filtered.length - 1) return null;
      return `Walk from <strong>${loc}</strong> to <strong>${filtered[idx + 1]}</strong>.`;
    })
    .filter(Boolean);

  // ---------- SMART AI PROMPT ----------
  let detailedPath = "";
  for (let i = 0; i < bestPath.length - 1; i++) {
    const n1 = graph.nodes.get(bestPath[i]);
    const n2 = graph.nodes.get(bestPath[i + 1]);
    const edge = (graph.adjacencyList.get(n1.id) || []).find((e) => e.to === n2.id);
    const dist = edge ? Number(edge.weight || 0) : 0;
    detailedPath += `${i + 1}) From "${n1.name}" at (${n1.lat.toFixed(6)}, ${n1.lng.toFixed(6)}) `
      + `to "${n2.name}" at (${n2.lat.toFixed(6)}, ${n2.lng.toFixed(6)}), distance ≈ ${dist.toFixed(1)} meters.\n`;
  }

  const walkTime = (bestDist / 1.4).toFixed(1); // seconds per meter

  const prompt = `
You are a friendly **campus navigation assistant**.
Use the following route data to give **clear, human-like walking directions** to a student.

🧭 Guidelines:
- Use natural language: “Walk straight ahead”, “Turn right”, “Continue until you see...”
- Avoid showing coordinates unless necessary.
- Mention approximate distances.
- End with total walking distance (~${bestDist.toFixed(
    2
  )} meters) and estimated time (~${walkTime} seconds).
- Keep the tone simple and friendly.

📍 Route Data:
${detailedPath}
`;

  const aiText = await fetchAI(prompt);

  const box = document.getElementById("routeExplanation");
  box.innerHTML = `
    <div style="font-family:Poppins,Arial;padding:12px;background:#f7faff;border-radius:10px;border-left:4px solid #0a66c2;">
      <h3 style="color:#083d77;margin:0 0 8px 0;">🚶 Step-by-step</h3>
      <ol style="margin-left:18px;line-height:1.6;color:#333;">
        ${steps.map((s) => `<li>${s}</li>`).join("")}
      </ol>
      <p style="margin-top:10px;background:#fff;padding:10px;border-left:4px solid #4da6ff;">
        <strong>AI Guidance:</strong> ${aiText}
      </p>
      <p style="margin-top:8px;color:#004d99;font-weight:600;">
        📏 Total Distance: ${bestDist.toFixed(2)} meters
      </p>
    </div>
  `;
});

// ========== Backend Call ==========
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
      console.warn("AI call returned non-ok:", res.status, err);
      return "AI explanation unavailable (server returned error).";
    }

    const data = await res.json();
    return data.result || "No AI explanation received.";
  } catch (e) {
    console.error("AI fetch error:", e);
    return "Error fetching AI explanation.";
  }
}
