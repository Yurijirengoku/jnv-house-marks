import { db } from './firebase-config.js';
import { collection, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// DOM references
const housesContainer = document.getElementById("housesContainer");
const averagesTableBody = document.querySelector("#averagesTable tbody");
const metaEl = document.getElementById("meta");
const refreshBtn = document.getElementById("refreshBtn");
const exportBtn = document.getElementById("exportCsvBtn");
const categoryFilter = document.getElementById("categoryFilter");
const alertArea = document.getElementById("alertArea");
const backToLoginBtn = document.getElementById("backToLoginBtn"); // Add button in HTML

let allEntries = [];

// Event listeners
document.addEventListener("DOMContentLoaded", () => loadResults());
refreshBtn.addEventListener("click", handleRefresh);
categoryFilter.addEventListener("change", () => renderResults(allEntries));
exportBtn.addEventListener("click", exportCSV);
if (backToLoginBtn) {
  backToLoginBtn.addEventListener("click", () => {
    window.location.href = "login.html"; // change to your actual login page
  });
}

// -------------------------
// Load + normalize data
// -------------------------
async function loadResults() {
  metaEl.textContent = "Loading results...";
  housesContainer.innerHTML = "";
  averagesTableBody.innerHTML = "";
  alertArea.innerHTML = "";

  try {
    const docs = [];

    try {
      const snap = await getDocs(collection(db, "scores"));
      snap.forEach(d => docs.push({ id: d.id, data: d.data(), col: "scores" }));
    } catch (e) {
      console.warn("Error reading 'scores' collection:", e);
    }

    try {
      const snap2 = await getDocs(collection(db, "judges_scores"));
      snap2.forEach(d => docs.push({ id: d.id, data: d.data(), col: "judges_scores" }));
    } catch (e) {
      // ignore if missing
    }

    if (docs.length === 0) {
      metaEl.textContent = "No score documents found.";
      return;
    }

    const entries = [];
    for (const docObj of docs) {
      const d = docObj.data || {};
      const category = String(d.category || "").trim().toLowerCase();
      const judge = d.judge || d.judgeName || "";

      if (d.scores && typeof d.scores === "object") {
        for (const [houseName, raw] of Object.entries(d.scores)) {
          const normalized = normalizeHouseScores(raw);
          entries.push({ house: houseName.trim() || "Unknown", category, judge, ...normalized });
        }
        continue;
      }

      const topKeys = Object.keys(d);
      const metadataKeys = new Set(["category", "judge", "createdAt", "timestamp", "judgeName"]);
      const possibleHouseKeys = topKeys.filter(k => {
        const v = d[k];
        return v && typeof v === "object" && Object.keys(v).length > 0;
      });
      const hasHouseLike = possibleHouseKeys.some(k => !metadataKeys.has(k));

      if (hasHouseLike) {
        for (const k of possibleHouseKeys) {
          if (metadataKeys.has(k)) continue;
          const normalized = normalizeHouseScores(d[k]);
          entries.push({ house: k.trim() || "Unknown", category, judge, ...normalized });
        }
        continue;
      }

      if (d.house) {
        const normalized = normalizeHouseScores(d);
        entries.push({ house: d.house.trim() || "Unknown", category, judge, ...normalized });
        continue;
      }

      const normalized = normalizeHouseScores(d);
      if (Object.values(normalized).some(v => typeof v === "number" && v !== 0)) {
        entries.push({ house: "Unknown", category, judge, ...normalized });
      }
    }

    allEntries = entries;
    renderResults(allEntries);

  } catch (err) {
    console.error("Error loading results:", err);
    metaEl.textContent = "Error loading results — check console.";
  }
}

// -------------------------
// Normalization helper
// -------------------------
function normalizeHouseScores(raw) {
  const out = { decoration: 0, items: 0, dorm: 0, fanTube: 0, footpath: 0, grass: 0, surrounding: 0, total: 0 };

  if (raw == null) return out;

  if (typeof raw === "number") { out.total = raw; return out; }
  if (typeof raw === "string" && raw.trim() !== "" && !isNaN(Number(raw))) {
    out.total = Number(raw); return out;
  }

  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).toLowerCase().replace(/[\s_\-]/g, "");
    const num = Number(v);
    const hasNumber = !isNaN(num);

    if (key.includes("decor")) out.decoration = hasNumber ? num : out.decoration;
    else if (key.includes("item")) out.items = hasNumber ? num : out.items;
    else if (key.includes("dorm") || key.includes("inside") || key.includes("bed")) out.dorm = hasNumber ? num : out.dorm;
    else if (key.includes("fan") || key.includes("tube")) out.fanTube = hasNumber ? num : out.fanTube;
    else if (key.includes("foot")) out.footpath = hasNumber ? num : out.footpath;
    else if (key.includes("grass")) out.grass = hasNumber ? num : out.grass;
    else if (key.includes("surround")) out.surrounding = hasNumber ? num : out.surrounding;
    else if (key.includes("total") || key.includes("sum")) out.total = hasNumber ? num : out.total;
    else if (v && typeof v === "object") {
      for (const [k2, v2] of Object.entries(v)) {
        const k2n = String(k2).toLowerCase();
        const n2 = Number(v2);
        if (isNaN(n2)) continue;
        if (k2n.includes("decor")) out.decoration += n2;
        else if (k2n.includes("item")) out.items += n2;
        else if (k2n.includes("dorm") || k2n.includes("inside")) out.dorm += n2;
        else if (k2n.includes("fan") || k2n.includes("tube")) out.fanTube += n2;
        else if (k2n.includes("foot")) out.footpath += n2;
        else if (k2n.includes("grass")) out.grass += n2;
        else if (k2n.includes("surround")) out.surrounding += n2;
        else out.total += n2;
      }
    } else if (hasNumber) {
      out.total += num;
    }
  }

  if (!out.total) {
    out.total = Number((out.decoration + out.items + out.dorm + out.fanTube + out.footpath + out.grass + out.surrounding).toFixed(2));
  }

  return out;
}

// -------------------------
// Render + aggregation
// -------------------------
function renderResults(entries) {
  const category = (categoryFilter.value || "").trim().toLowerCase();
  const filtered = category === "overall" || category === "" ? entries : entries.filter(e => (String(e.category || "").trim().toLowerCase()) === category);

  if (!filtered.length) {
    metaEl.textContent = "No results for selected category.";
    housesContainer.innerHTML = "";
    averagesTableBody.innerHTML = "";
    return;
  }

  metaEl.textContent = `Showing ${category || "overall"} category (${filtered.length} entries)`;

  const houseMap = {};
  filtered.forEach(e => {
    const h = e.house || "Unknown";
    if (!houseMap[h]) houseMap[h] = [];
    houseMap[h].push(e);
  });

  const houseResults = Object.keys(houseMap).map(house => {
    const list = houseMap[house];
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length || 0;

    const decoration = avg(list.map(x => x.decoration));
    const items = avg(list.map(x => x.items));
    const dorm = avg(list.map(x => x.dorm));
    const fanTube = avg(list.map(x => x.fanTube));
    const footpath = avg(list.map(x => x.footpath));
    const grass = avg(list.map(x => x.grass));
    const surrounding = avg(list.map(x => x.surrounding));
    const total = decoration + items + dorm + fanTube + footpath + grass + surrounding;

    return { house, decoration, items, dorm, fanTube, footpath, grass, surrounding, total };
  });

  houseResults.sort((a, b) => b.total - a.total);
  houseResults.forEach((h, i) => h.rank = i + 1);

  housesContainer.innerHTML = "";
  houseResults.forEach((h, idx) => {
    const card = document.createElement("div");
    card.className = "col-md-4";
    card.innerHTML = `
      <div class="card h-100 ${idx === 0 ? "winner" : ""}">
        <div class="card-body">
          <h5 class="card-title">${escapeHtml(h.house)}</h5>
          <p>Total Score: <strong>${h.total.toFixed(2)}</strong></p>
          <p>Rank: ${h.rank}</p>
        </div>
      </div>
    `;
    housesContainer.appendChild(card);
  });

  averagesTableBody.innerHTML = "";
  houseResults.forEach(h => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(h.house)}</td>
      <td>${h.decoration.toFixed(2)}</td>
      <td>${h.items.toFixed(2)}</td>
      <td>${h.dorm.toFixed(2)}</td>
      <td>${h.fanTube.toFixed(2)}</td>
      <td>${h.footpath.toFixed(2)}</td>
      <td>${h.grass.toFixed(2)}</td>
      <td>${h.surrounding.toFixed(2)}</td>
      <td><strong>${h.total.toFixed(2)}</strong></td>
      <td>${h.rank}</td>
    `;
    averagesTableBody.appendChild(row);
  });
}

// -------------------------
// Refresh / Delete helper
// -------------------------
async function handleRefresh() {
  const category = (categoryFilter.value || "").trim().toLowerCase();
  if (!category) {
    alert("Please select a category before refreshing.");
    return;
  }

  const answer = confirm(`Delete ALL scores for "${category}" category and reset judge logins? This cannot be undone.`);
  if (!answer) return;

  await clearCategoryScores(category);
  await clearJudgeLogins();

  showAlert(`All "${category}" scores and judge logins deleted.`, "danger");
  await loadResults();
}

async function clearCategoryScores(category) {
  const collectionsToClear = ["scores", "judges_scores"];

  let categoriesToDelete = [];
  if (category === "overall") {
    categoriesToDelete = ["boys", "girls"];
  } else {
    categoriesToDelete = [category];
  }

  for (const colName of collectionsToClear) {
    for (const cat of categoriesToDelete) {
      try {
        const qSnap = await getDocs(query(collection(db, colName), where("category", "==", cat)));
        for (const d of qSnap.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      } catch (e) {
        console.error(`Error deleting ${cat} in ${colName}:`, e);
      }
    }
  }
}

async function clearJudgeLogins() {
  try {
    const qSnap = await getDocs(collection(db, "judgeLogins"));
    for (const d of qSnap.docs) {
      await deleteDoc(doc(db, "judgeLogins", d.id));
    }
  } catch (e) {
    console.error("Error deleting judge logins:", e);
  }
}

// -------------------------
// Utilities
// -------------------------
function exportCSV() {
  const rows = document.querySelectorAll("table tr");
  const csv = Array.from(rows).map(row => {
    const cols = row.querySelectorAll("td, th");
    return Array.from(cols).map(c => `"${String(c.innerText).replace(/"/g, '""')}"`).join(",");
  }).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "results.csv";
  link.click();
}

function showAlert(msg, type = "info") {
  alertArea.innerHTML = `<div class="alert alert-${type}">${escapeHtml(msg)}</div>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
