// --- FULL REVISED script.js ---

// Firebase config (Use your actual config)
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
var auth = firebase.auth(); // <-- Firebase Authentication Instance
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

// Register Student 
function registerStudent() {
    var name = document.getElementById("regName").value.trim();
    var studentClass = document.getElementById("regClass").value.trim();
    var roll = document.getElementById("regRoll").value.trim();
    var guardian = document.getElementById("regGuardian").value.trim();
    if (!name || !studentClass || !roll || !guardian) return alert("⚠️ Fill all fields");

    var year = new Date().getFullYear();
    var studentId = "S" + year + String(studentClass).padStart(2, '0') + String(roll).padStart(2, '0');

    database.ref('students/' + studentId).set({
        name: name,
        class: studentClass,
        roll: roll,
        guardian: guardian,
        status: "pending"
    }, function(error) {
        if (error) alert("❌ " + error);
        else {
            alert("✅ Registration successful! Student ID: " + studentId);
            document.getElementById("registerForm").reset();
            showLogin();
        }
    });
}

// SECURE LOGIN FUNCTION - FINAL CORRECTED VERSION
function login() {
    var id = document.getElementById("studentId").value.trim();
    clearLoginError();

    // 1. ADMIN FLOW CHECK
    if (id === "admin" || id.includes('@')) {

        var email = id.includes('@') ? id : prompt("Enter admin email:");
        var password = prompt("Enter admin password:");

        if (!email || !password) {
            document.getElementById("loginError").innerText = "Admin login cancelled.";
            return; // Exit after cancellation
        }

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // --- SUCCESS BLOCK: SHOW ADMIN PANEL ---
                document.getElementById("login-page").classList.add("hidden");
                document.getElementById("admin-panel").classList.remove("hidden");

                loadAdminPanel();
                loadStudentFeesDropdown();
            })
            .catch((error) => {
                // --- FAILURE BLOCK: SHOW ERROR MESSAGE ---
                console.error("Admin Login Error:", error.code, error.message);
                document.getElementById("loginError").innerText = "❌ Admin Login Failed: Invalid email or password.";
            });

        return; // *** CRITICAL: EXIT THE FUNCTION AFTER ATTEMPTING ADMIN LOGIN ***
    }

    // 2. STUDENT FLOW (Only runs if the input was NOT an admin keyword/email)
    database.ref('students/' + id).once('value').then(function(snapshot) {
        if (snapshot.exists()) {
            var student = snapshot.val();
            
            // Check for approval status
            if (student.status !== "approved") {
                document.getElementById("loginError").innerText = "⏳ Pending admin approval";
                return;
            }
            
            // Student is approved, show dashboard
            currentStudent = id;
            document.getElementById("login-page").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            document.getElementById("studentName").innerText =
                "Welcome, " + student.name + " (Class " + student.class + ", Roll " + student.roll + ")\nGuardian: " + student.guardian;
            loadStudentDashboard(id);
        } else {
            // No student ID found
            document.getElementById("loginError").innerText = "❌ Invalid ID!";
        }
    });
}

// Admin Panel (Remaining functions are unchanged as they were not part of the login error)
function loadAdminPanel() {
    if (!auth.currentUser) return logout();
    database.ref('students').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        var students = snapshot.val();
        var pendingHTML = "", approvedHTML = "";
        for (var id in students) {
            var s = students[id];
            var line = s.name + " (Class " + s.class + ", Roll " + s.roll + ") - ID: " + id;
            if (s.status === "pending") pendingHTML += "<li>" + line + " <button onclick=\"approveStudent('" + id + "')\">Approve</button></li>";
            else if (s.status === "approved") approvedHTML += "<li>" + line + " <button onclick=\"markPaid('" + id + "')\">Mark Paid</button></li>";
        }
        document.getElementById("pendingStudents").innerHTML = pendingHTML || "<li>No pending students</li>";
        document.getElementById("approvedStudents").innerHTML = approvedHTML || "<li>No approved students</li>";
    });
}

function approveStudent(studentId) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/status').set("approved", function() {
        initializeMonthlyFees(studentId);
        alert("✅ Student " + studentId + " approved!");
        loadAdminPanel();
        loadStudentFeesDropdown();
    });
}

function markPaid(studentId) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/feeStatus').set("paid", function() {
        alert("💰 Student " + studentId + " fee marked as paid!");
        loadAdminPanel();
    });
}

function initializeMonthlyFees(studentId) {
    if (!auth.currentUser) return;
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var updates = {};
    months.forEach(function(m) {
        updates[m] = "unpaid";
    });
    database.ref('students/' + studentId + '/fees').set(updates);
}

function loadStudentFeesDropdown() {
    if (!auth.currentUser) return;
    database.ref('students').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        var options = '<option value="">Select Student</option>';
        var students = snapshot.val();
        for (var id in students) {
            if (students[id].status === "approved") options += '<option value="' + id + '">' + students[id].name + ' (ID: ' + id + ')</option>';
        }
        document.getElementById("selectStudentFees").innerHTML = options;
    });
}

function loadStudentFees(studentId) {
    if (!auth.currentUser) return;
    if (!studentId) {
        document.getElementById("monthlyFees").innerHTML = '';
        return;
    }
    database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        var html = '';
        var fees = snapshot.val();
        for (var month in fees) {
            html += '<li>' + month + ': ' + fees[month] + ' <button onclick="markMonthPaid(\'' + studentId + '\',\'' + month + '\')">Mark Paid</button></li>';
        }
        document.getElementById("monthlyFees").innerHTML = html;
    });
}

function markMonthPaid(studentId, month) {
    if (!auth.currentUser) return logout();
    database.ref('students/' + studentId + '/fees/' + month).set("paid", function() {
        loadStudentFees(studentId);
    });
}

function loadStudentDashboard(studentId) {
    database.ref('students/' + studentId + '/fees').once('value').then(function(snapshot) {
        if (!snapshot.exists()) return;
        var html = '<h3>Monthly Fees:</h3><ul>';
        var fees = snapshot.val();
        for (var month in fees) html += '<li>' + month + ': ' + fees[month] + '</li>';
        html += '</ul>';
        document.getElementById("studentFees").innerHTML = html;
    });
}

