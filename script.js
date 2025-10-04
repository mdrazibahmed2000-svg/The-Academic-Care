// ===================== FIREBASE CONFIG ===================== //
var firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "the-academic-care.firebaseapp.com",
  databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "the-academic-care",
  storageBucket: "the-academic-care.appspot.com",
  messagingSenderId: "728354914429",
  appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();
var currentStudent = "";

// ===================== NAVIGATION ===================== //
function showRegister() {
  document.getElementById("login-page").classList.add("hidden");
  document.getElementById("register-page").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("register-page").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");
}

function logout() {
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("admin-panel").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");
}

// ===================== REGISTER ===================== //
function registerStudent() {
  const name = document.getElementById("regName").value.trim();
  const cls = document.getElementById("regClass").value.trim();
  const roll = document.getElementById("regRoll").value.trim();
  const guardian = document.getElementById("regGuardian").value.trim();

  if (!name || !cls || !roll || !guardian) return alert("Fill all fields");

  const year = new Date().getFullYear();
  const id = "S" + year + cls.padStart(2, '0') + roll.padStart(2, '0');

  db.ref("students/" + id).set({
    name, class: cls, roll, guardian, status: "pending"
  }, err => {
    if (err) alert("Error: " + err);
    else {
      alert("✅ Registered! ID: " + id);
      showLogin();
    }
  });
}

// ===================== LOGIN ===================== //
function login() {
  const id = document.getElementById("studentId").value.trim();
  const err = document.getElementById("loginError");
  err.textContent = "";

  if (id === "admin") {
    const pass = prompt("Enter admin password:");
    db.ref("settings/adminPassword").once("value").then(s => {
      if (!s.exists()) return alert("Admin password not set!");
      if (pass === s.val()) {
        document.getElementById("login-page").classList.add("hidden");
        document.getElementById("admin-panel").classList.remove("hidden");
        loadAdminPanel();
      } else alert("❌ Wrong password!");
    });
    return;
  }

  db.ref("students/" + id).once("value").then(s => {
    if (!s.exists()) return err.textContent = "❌ Invalid ID!";
    const data = s.val();
    if (data.status !== "approved") return err.textContent = "⏳ Pending approval";

    currentStudent = id;
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    document.getElementById("studentName").textContent =
      `${data.name} (Class ${data.class}, Roll ${data.roll})`;
    loadStudentDashboard(id);
  });
}

// ===================== ADMIN PANEL ===================== //
function loadAdminPanel() {
  db.ref("students").once("value").then(s => {
    const data = s.val() || {};
    let pending = "", approved = "";
    for (let id in data) {
      const st = data[id];
      if (st.status === "pending")
        pending += `<li>${st.name} (${st.class}-${st.roll}) <button onclick="approveStudent('${id}')" class='btn bg-green-500 hover:bg-green-600 text-white text-xs'>Approve</button></li>`;
      else if (st.status === "approved")
        approved += `<li>${st.name} (${st.class}-${st.roll}) <button onclick="markAllPaid('${id}')"
        class='btn bg-blue-500 hover:bg-blue-600 text-white text-xs'>Mark Paid</button></li>`;
    }
    document.getElementById("pendingStudents").innerHTML = pending || "<li>No pending</li>";
    document.getElementById("approvedStudents").innerHTML = approved || "<li>No approved</li>";
    loadStudentDropdown();
  });
}

function approveStudent(id) {
  db.ref("students/" + id + "/status").set("approved", () => {
    initializeMonthlyFees(id);
    alert("Approved!");
    loadAdminPanel();
  });
}

function initializeMonthlyFees(id) {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const obj = {};
  months.forEach(m => obj[m] = { status: "UNPAID" });
  db.ref("students/" + id + "/fees").set(obj);
}

function loadStudentDropdown() {
  db.ref("students").once("value").then(s => {
    const data = s.val() || {};
    let html = '<option value="">Select Student</option>';
    for (let id in data)
      if (data[id].status === "approved")
        html += `<option value="${id}">${data[id].name} (${id})</option>`;
    document.getElementById("studentSelector").innerHTML = html;
  });
}

// ===================== FEES MANAGEMENT ===================== //
function loadMonthlyFees() {
  const id = document.getElementById("studentSelector").value;
  if (!id) return document.getElementById("monthlyFees").innerHTML = "<li>Select a student</li>";
  db.ref("students/" + id + "/fees").on("value", s => renderPayments(id, s.val() || {}));
}

function renderPayments(id, data) {
  const container = document.getElementById("monthlyFees");
  container.innerHTML = "";
  for (let month in data) {
    const info = data[month];
    const status = info.status || "UNPAID";
    const color = status === "PAID" ? "#10b981" : status === "BREAK" ? "#f97316" : "#ef4444";

    container.innerHTML += `
      <li class="fee-item" style="border-left-color:${color}">
        <span><b>${month}</b> — <span style="color:${color};font-weight:bold;">${status}</span></span>
        <div class="space-x-1">
          <button class="btn bg-blue-500 hover:bg-blue-600 text-white text-xs" onclick="markPaid('${id}','${month}')">Paid</button>
          <button class="btn bg-orange-500 hover:bg-orange-600 text-white text-xs" onclick="markBreak('${id}','${month}')">Break</button>
          <button class="btn bg-gray-500 hover:bg-gray-600 text-white text-xs" onclick="undoPayment('${id}','${month}')">Undo</button>
        </div>
      </li>`;
  }
}

function markPaid(id, month) {
  const method = prompt(`Payment method for ${month}?`);
  if (!method) return;
  db.ref(`students/${id}/fees/${month}`).set({
    status: "PAID",
    method,
    recordedBy: "admin",
    timestamp: new Date().toISOString()
  });
}

function markBreak(id, month) {
  const reason = prompt(`Reason for break in ${month}?`);
  if (!reason) return;
  db.ref(`students/${id}/fees/${month}`).set({
    status: "BREAK",
    reason,
    recordedBy: "admin",
    timestamp: new Date().toISOString()
  });
}

function undoPayment(id, month) {
  if (!confirm(`Undo ${month}?`)) return;
  db.ref(`students/${id}/fees/${month}`).set({ status: "UNPAID" });
}

// ===================== STUDENT DASHBOARD ===================== //
function loadStudentDashboard(id) {
  db.ref("students/" + id + "/fees").on("value", s => {
    const fees = s.val() || {};
    let html = "<ul>";
    for (let m in fees)
      html += `<li>${m}: ${fees[m].status}</li>`;
    html += "</ul>";
    document.getElementById("studentFees").innerHTML = html;
  });
}
