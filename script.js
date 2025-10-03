// Firebase config (Ensure this is your actual config)
var firebaseConfig = {
  apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8",
  authDomain: "the-academic-care.firebaseapp.com",
  databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "the-academic-care",
  storageBucket: "the-academic-care.firebasestorage.app",
  messagingSenderId: "728354914429",
  appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
  measurementId: "G-37MDWVYWFJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var database = firebase.database();
var auth = firebase.auth(); // <-- NEW: Firebase Authentication Instance
var currentStudent = "";

// UI Functions
function showRegister() {
  document.getElementById("login-page").classList.add("hidden");
  document.getElementById("register-page").classList.remove("hidden");
  clearLoginError();
}

function showLogin() {
  document.getElementById("register-page").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");
}

function logout() {
  // Use Firebase Auth sign out for the admin
  auth.signOut();
  currentStudent = "";
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("admin-panel").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");
  clearLoginError();
}

function clearLoginError() {
  document.getElementById("loginError").innerText = "";
}

// Register Student (No changes, as this is for data storage)
function registerStudent() {
  var name = document.getElementById("regName").value.trim();
  var studentClass = document.getElementById("regClass").value.trim();
  var roll = document.getElementById("regRoll").value.trim();
  var guardian = document.getElementById("regGuardian").value.trim();
  if (!name || !studentClass || !roll || !guardian) return alert("⚠️ Fill all fields");

  var year = new Date().getFullYear();
  var studentId = "S" + year + String(studentClass).padStart(2,'0') + String(roll).padStart(2,'0');

  database.ref('students/' + studentId).set({
    name: name,
    class: studentClass,
    roll: roll,
    guardian: guardian,
    status: "pending"
  }, function(error){
    if(error) alert("❌ " + error);
    else {
      alert("✅ Registration successful! Student ID: " + studentId);
      document.getElementById("registerForm").reset();
      showLogin();
    }
  });
}

// Login - SECURED VERSION
function login() {
  var id = document.getElementById("studentId").value.trim();
  clearLoginError();

  if(id === "admin") {
    // --- SECURE ADMIN LOGIN VIA FIREBASE AUTHENTICATION ---
    var email = prompt("Enter admin email:");
    var password = prompt("Enter admin password:");

    if (!email || !password) {
        document.getElementById("loginError").innerText = "Admin login cancelled.";
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Logged in successfully. The password check was done securely on the Firebase servers.
        console.log("Admin logged in with UID:", userCredential.user.uid);
        
        // Hide login, show admin panel
        document.getElementById("login-page").classList.add("hidden");
        document.getElementById("admin-panel").classList.remove("hidden");
        
        // Load data
        loadAdminPanel();
        loadStudentFeesDropdown();

        // Security Reminder: After this, your Realtime Database rules MUST check auth.uid for all write operations.
      })
      .catch((error) => {
        // Handle common errors like wrong password or invalid user
        console.error("Admin Login Error:", error.code, error.message);
        document.getElementById("loginError").innerText = "❌ Admin Login Failed: Invalid email or password.";
      });
      
    return;
  }

  // --- Student Login (Unchanged for now, still requires database approval check) ---
  database.ref('students/' + id).once('value').then(function(snapshot){
    if(snapshot.exists()){
      var student = snapshot.val();
      if(student.status !== "approved"){
        document.getElementById("loginError").innerText = "⏳ Pending admin approval";
        return;
      }
      currentStudent = id;
      document.getElementById("login-page").classList.add("hidden");
      document.getElementById("dashboard").classList.remove("hidden");
      document.getElementById("studentName").innerText = 
        "Welcome, " + student.name + " (Class " + student.class + ", Roll " + student.roll + ")\nGuardian: " + student.guardian;
      loadStudentDashboard(id);
    } else {
      document.getElementById("loginError").innerText = "❌ Invalid ID!";
    }
  });
}

// Admin Panel (No changes needed here, but the data access must be secured by DB rules)
function loadAdminPanel() {
  // Ensure we are logged in before attempting to read data
  if (!auth.currentUser) return logout();

  database.ref('students').once('value').then(function(snapshot){
    if(!snapshot.exists()) return;
    var students = snapshot.val();
    var pendingHTML = "", approvedHTML = "";
    for(var id in students){
      var s = students[id];
      var line = s.name + " (Class " + s.class + ", Roll " + s.roll + ") - ID: " + id;
      if(s.status === "pending") pendingHTML += "<li>" + line + " <button onclick=\"approveStudent('" + id + "')\">Approve</button></li>";
      else if(s.status === "approved") approvedHTML += "<li>" + line + " <button onclick=\"markPaid('" + id + "')\">Mark Paid</button></li>";
    }
    document.getElementById("pendingStudents").innerHTML = pendingHTML || "<li>No pending students</li>";
    document.getElementById("approvedStudents").innerHTML = approvedHTML || "<li>No approved students</li>";
  });
}

function approveStudent(studentId){
  if (!auth.currentUser) return logout(); // Check if admin is logged in
  database.ref('students/' + studentId + '/status').set("approved", function(){
    initializeMonthlyFees(studentId);
    alert("✅ Student " + studentId + " approved!");
    loadAdminPanel();
    loadStudentFeesDropdown();
  });
}

function markPaid(studentId){
  if (!auth.currentUser) return logout(); // Check if admin is logged in
  database.ref('students/' + studentId + '/feeStatus').set("paid", function(){
    alert("💰 Student " + studentId + " fee marked as paid!");
    loadAdminPanel();
  });
}

// Monthly Fees (No functional changes)
function initializeMonthlyFees(studentId){
  if (!auth.currentUser) return logout(); 
  var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var updates = {};
  months.forEach(function(m){ updates[m] = "unpaid"; });
  database.ref('students/' + studentId + '/fees').set(updates);
}

function loadStudentFeesDropdown(){
  if (!auth.currentUser) return;
  database.ref('students').once('value').then(function(snapshot){
    if(!snapshot.exists()) return;
    var options = '<option value="">Select Student</option>';
    var students = snapshot.val();
    for(var id in students){
      if(students[id].status === "approved") options += '<option value="'+students[id].uid+'">'+students[id].name+' (ID: '+id+')</option>';
    }
    document.getElementById("selectStudentFees").innerHTML = options;
  });
}

function loadStudentFees(studentId){
  if (!auth.currentUser) return;
  if(!studentId){ document.getElementById("monthlyFees").innerHTML = ''; return; }
  database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot){
    if(!snapshot.exists()) return;
    var html = '';
    var fees = snapshot.val();
    for(var month in fees){
      html += '<li>'+month+': '+fees[month]+' <button onclick="markMonthPaid(\''+studentId+'\',\''+month+'\')">Mark Paid</button></li>';
    }
    document.getElementById("monthlyFees").innerHTML = html;
  });
}

function markMonthPaid(studentId, month){
  if (!auth.currentUser) return logout(); // Check if admin is logged in
  database.ref('students/' + studentId + '/fees/' + month).set("paid", function(){
    loadStudentFees(studentId);
  });
}

// Student Dashboard (No functional changes)
function loadStudentDashboard(studentId){
  // Note: This function doesn't need 'auth.currentUser' check because it relies on the student login
  // which is already validated by the presence of 'currentStudent'.
  database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot){
    if(!snapshot.exists()) return;
    var html = '<h3>Monthly Fees:</h3><ul>';
    var fees = snapshot.val();
    for(var month in fees) html += '<li>'+month+': '+fees[month]+'</li>';
    html += '</ul>';
    document.getElementById("studentFees").innerHTML = html;
  });
}

// REMOVED: The insecure changeAdminPassword() function has been deleted.
// Password management must be done through Firebase Auth or the Firebase Console.
