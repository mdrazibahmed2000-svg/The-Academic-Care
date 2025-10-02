// Firebase config
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
  currentStudent = "";
  document.getElementById("dashboard").classList.add("hidden");
  document.getElementById("admin-panel").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");
  clearLoginError();
}

function clearLoginError() {
  document.getElementById("loginError").innerText = "";
}

// Register Student
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

// Login
function login() {
  var id = document.getElementById("studentId").value.trim();
  clearLoginError();

  if(id === "admin") {
    database.ref('settings/adminPassword').once('value').then(function(snapshot){
      if(snapshot.exists()){
        var password = prompt("Enter admin password:");
        if(password === snapshot.val()){
          document.getElementById("login-page").classList.add("hidden");
          document.getElementById("admin-panel").classList.remove("hidden");
          loadAdminPanel();
          loadStudentFeesDropdown();
        } else alert("❌ Wrong password!");
      } else alert("⚠️ Admin password not set!");
    });
    return;
  }

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

// Admin Panel
function loadAdminPanel() {
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
  database.ref('students/' + studentId + '/status').set("approved", function(){
    initializeMonthlyFees(studentId);
    alert("✅ Student " + studentId + " approved!");
    loadAdminPanel();
    loadStudentFeesDropdown();
  });
}

function markPaid(studentId){
  database.ref('students/' + studentId + '/feeStatus').set("paid", function(){
    alert("💰 Student " + studentId + " fee marked as paid!");
    loadAdminPanel();
  });
}

// Monthly Fees
function initializeMonthlyFees(studentId){
  var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var updates = {};
  months.forEach(function(m){ updates[m] = "unpaid"; });
  database.ref('students/' + studentId + '/fees').set(updates);
}

function loadStudentFeesDropdown(){
  database.ref('students').once('value').then(function(snapshot){
    if(!snapshot.exists()) return;
    var options = '<option value="">Select Student</option>';
    var students = snapshot.val();
    for(var id in students){
      if(students[id].status === "approved") options += '<option value="'+id+'">'+students[id].name+' (ID: '+id+')</option>';
    }
    document.getElementById("selectStudentFees").innerHTML = options;
  });
}

function loadStudentFees(studentId){
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
  database.ref('students/' + studentId + '/fees/' + month).set("paid", function(){
    loadStudentFees(studentId);
  });
}

// Student Dashboard
function loadStudentDashboard(studentId){
  database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot){
    if(!snapshot.exists()) return;
    var html = '<h3>Monthly Fees:</h3><ul>';
    var fees = snapshot.val();
    for(var month in fees) html += '<li>'+month+': '+fees[month]+'</li>';
    html += '</ul>';
    document.getElementById("studentFees").innerHTML = html;
  });
}

// Admin Password Change
function changeAdminPassword(){
  var newPassword = prompt("Enter new admin password:");
  if(!newPassword) return alert("⚠️ Cannot be empty");
  database.ref('settings/adminPassword').set(newPassword, function(error){
    if(error) alert("❌ Failed to update password: " + error);
    else alert("✅ Admin password updated!");
  });
}
