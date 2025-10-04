// ===================== LOGIN ===================== //
function login() {
  const id = document.getElementById("studentId").value.trim();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();
  const err = document.getElementById("loginError");
  err.textContent = "";

  // ---------- ADMIN LOGIN ----------
  if (id.toLowerCase() === "admin") {
    if (!email || !password) {
      err.textContent = "Please enter admin email and password.";
      return;
    }

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(() => {
        document.getElementById("login-page").classList.add("hidden");
        document.getElementById("admin-panel").classList.remove("hidden");
        loadAdminPanel();
      })
      .catch(e => err.textContent = e.message);
    return;
  }

  // ---------- STUDENT LOGIN ----------
  db.ref("students/" + id).once("value").then(s => {
    if (!s.exists()) return err.textContent = "❌ Invalid ID!";
    const data = s.val();
    if (data.status !== "approved") return err.textContent = "⏳ Awaiting approval.";

    currentStudent = id;
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    document.getElementById("studentName").textContent =
      `${data.name} (Class ${data.class}, Roll ${data.roll})`;

    loadStudentDashboard(id);
  });
}
