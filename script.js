// --- COMPLETE, FINAL, AND ROBUST script.js ---

// 🚨 CRITICAL: REPLACE THE PLACEHOLDER CONFIG VALUES BELOW WITH YOUR ACTUAL FIREBASE KEYS
// If these keys are incorrect, the script will stop running, and the login button will not work.
var firebaseConfig = {
    apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8", // <-- REPLACE THIS
    authDomain: "the-academic-care.firebaseapp.com",
    databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "the-academic-care",
    storageBucket: "the-academic-care.firebasestorage.app",
    messagingSenderId: "728354914429",
    appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
    measurementId: "G-37MDWVYWFJ"
};

var database;
var auth;
var currentStudent = "";

// Initialize Firebase with Error Handling
// The try...catch block prevents the entire script from crashing if config is bad or SDKs are missing.
try {
    // Check if firebase object is available
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
        // This likely means the SDK links in index.html are missing or wrong.
        throw new Error("Firebase SDK not loaded. Check index.html <script> links.");
    }
    
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();
    console.log("✅ Firebase Initialized successfully.");
} catch (error) {
    console.error("❌ FATAL ERROR: Firebase Initialization Failed. Check firebaseConfig in script.js and SDK links in index.html.", error);
    
    // Display an error message to the user when the window loads (this matches the screenshot)
    window.onload = function() {
        const loginErrorElement = document.getElementById("loginError");
        if (loginErrorElement) {
            loginErrorElement.innerText = "❌ APP ERROR: Failed to connect to Firebase. Check console/config.";
        }
    };
}


// Utility function to get the current date in DD-MM-YYYY format
function getCurrentDate() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return dd + '-' + mm + '-' + yyyy;
}

// Utility function to get the correct CSS class for status
function getStatusClass(status) {
    if (status === "paid") return "status-paid";
    if (status === "unpaid") return "status-unpaid";
    if (status === "break") return "status-break";
    return "";
}

// FUNCTION: Toggles visibility of collapsible sections (FOR STUDENT DASHBOARD)
function toggleSection(contentId) {
    const content = document.getElementById(contentId);
    const header = document.getElementById(contentId.replace('Content', 'Header'));
    
    if (!content || !header) return;

    // Check if the content is currently hidden
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        // Update arrow from down (⬇️) to up (⬆️)
        header.innerHTML = header.innerHTML.replace('⬇️', '⬆️');
    } else {
        content.classList.add('hidden');
        // Update arrow from up (⬆️) to down (⬇️)
        header.innerHTML = header.innerHTML.replace('⬆️', '⬇️');
    }
}

// --- UI NAVIGATION FUNCTIONS ---
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
    // Attempt Firebase sign out if admin is logged in
    if (auth && auth.currentUser) {
        auth.signOut();
    }
    currentStudent = "";
    // Hide all dashboards and show login page
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("admin-panel").classList.add("hidden");
    document.getElementById("login-page").classList.remove("hidden");
    document.getElementById("studentId").value = ""; // Clear the ID field
    clearLoginError();
}

function clearLoginError() {
    const loginErrorElement = document.getElementById("loginError");
    if (loginErrorElement) {
        loginErrorElement.innerText = "";
    }
}

// --- STUDENT REGISTRATION ---
function registerStudent() {
    // Check if database initialized (might be blocked by bad config)
    if (!database) {
        // Use custom message box instead of alert in final version
        alert("❌ Database not initialized. Cannot register. Check Firebase Config."); 
        return;
    }

    var name = document.getElementById("regName").value.trim();
    var studentClass = document.getElementById("regClass").value.trim();
    var roll = document.getElementById("regRoll").value.trim();
    var guardian = document.getElementById("regGuardian").value.trim();
    
    if (!name || !studentClass || !roll || !guardian) {
        alert("⚠️ Fill all fields");
        return;
    }

    var year = new Date().getFullYear();
    // Generate ID: S + Year + Padded Class + Padded Roll
    var studentId = "S" + year + String(studentClass).padStart(2, '0') + String(roll).padStart(2, '0');

    database.ref('students/' + studentId).set({
        name: name,
        class: studentClass,
        roll: roll,
        guardian: guardian,
        status: "pending" // Admin must approve
    }, function(error) {
        if (error) {
            alert("❌ Database Write Error: " + error.message);
        }
        else {
            alert("✅ Registration successful! Student ID: " + studentId + ". Please wait for admin approval.");
            document.getElementById("registerForm").reset();
            showLogin();
        }
    });
}

// --- LOGIN FUNCTION ---
function login() {
    if (!database || !auth) {
        document.getElementById("loginError").innerText = "❌ Application failed to load. Check console for Firebase config errors.";
        return;
    }
    
    var id = document.getElementById("studentId").value.trim();
    clearLoginError();
    
    if (!id) {
        document.getElementById("loginError").innerText = "❌ Please enter a Student ID or 'admin' email.";
        return;
    }

    // 1. ADMIN FLOW CHECK 
    if (id === "admin" || id.includes('@')) {
        var email = id.includes('@') ? id : prompt("Enter admin email:");
        var password = prompt("Enter admin password:");

        if (!email || !password) {
            document.getElementById("loginError").innerText = "Admin login cancelled.";
            return;
        }

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                document.getElementById("login-page").classList.add("hidden");
                document.getElementById("admin-panel").classList.remove("hidden");
                loadAdminPanel();
                loadStudentFeesDropdown();
            })
            .catch((error) => {
                console.error("Admin Login Error:", error.code, error.message);
                let errorMsg = "❌ Admin Login Failed. ";
                if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                    errorMsg += "Invalid email or password.";
                } else {
                    errorMsg += "Check network or console.";
                }
                document.getElementById("loginError").innerText = errorMsg;
            });
        return; 
    }

    // 2. STUDENT FLOW (Requires "true" read access at /students/ in rules)
    database.ref('students/' + id).once('value').then(function(snapshot) {
        if (snapshot.exists()) {
            var student = snapshot.val();
            
            if (student.status !== "approved") {
                document.getElementById("loginError").innerText = "⏳ Login failed: Student is " + student.status + ". Wait for admin approval.";
                return;
            }
            
            currentStudent = id;
            document.getElementById("login-page").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            
            // Set initial collapse state for dashboard
            document.getElementById("profileContent").classList.add("hidden");
            document.getElementById("feesContent").classList.add("hidden");
            document.getElementById("profileHeader").innerHTML = "My Profile ⬇️";
            document.getElementById("feesHeader").innerHTML = "Tuition Fee Status ⬇️";

            loadStudentDashboard(id); 
        } else {
            document.getElementById("loginError").innerText = "❌ Invalid Student ID or student not registered!";
        }
    }).catch(error => {
        console.error("Database Login Error (Check Firebase Rules):", error);
        document.getElementById("loginError").innerText = "❌ Connection/Permission Error. Ensure Firebase Rules are published correctly.";
    });
}

// --- ADMIN FUNCTIONS ---

function loadAdminPanel() {
    if (!auth || !auth.currentUser) return logout();
    
    database.ref('students').once('value').then(function(snapshot) {
        
        var students = snapshot.val();
        var pendingHTML = "";
        
        // Loop through all students to find pending registrations
        for (var id in students) {
            var s = students[id];
            
            if (s.status === "pending") {
                var line = s.name + " (Class " + s.class + ", Roll " + s.roll + ") - ID: " + id;
                pendingHTML += `<li>${line} <button class="mark-paid-btn" onclick="approveStudent('${id}')">Approve</button></li>`;
            } 
        }
        
        document.getElementById("pendingStudents").innerHTML = pendingHTML || "<li>No pending students</li>";
    });
}

function approveStudent(studentId) {
    if (!auth || !auth.currentUser) return logout();
    
    // 1. Set status to "approved"
    database.ref('students/' + studentId + '/status').set("approved", function(error) {
        if (error) {
            console.error(error);
            alert("❌ Approval failed.");
        } else {
            // 2. Initialize fees for the current year
            initializeMonthlyFees(studentId);
            alert("✅ Student " + studentId + " approved!");
            // 3. Reload admin UI elements
            loadAdminPanel();
            loadStudentFeesDropdown();
        }
    });
}

function initializeMonthlyFees(studentId) {
    if (!auth || !auth.currentUser) return;
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var updates = {};
    // Set initial 'unpaid' status for all months
    months.forEach(function(m) {
        updates[m] = "unpaid";
    });
    database.ref('students/' + studentId + '/fees').set(updates);
}

function loadStudentFeesDropdown() {
    if (!auth || !auth.currentUser) return;
    database.ref('students').once('value').then(function(snapshot) {
        var options = '<option value="">Select Student</option>';
        if (snapshot.exists()) {
            var students = snapshot.val();
            for (var id in students) {
                // Only show approved students in the fees dropdown
                if (students[id].status === "approved") options += '<option value="' + id + '">' + students[id].name + ' (ID: ' + id + ')</option>';
            }
        }
        document.getElementById("selectStudentFees").innerHTML = options;
    });
}

function loadStudentFees(studentId) {
    if (!auth || !auth.currentUser) return;
    if (!studentId) {
        document.getElementById("monthlyFees").innerHTML = '';
        return;
    }
    
    var chronologicalMonths = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    database.ref('students/' + studentId + '/fees').on('value', function(snapshot) { // Use on() for real-time updates
        if (!snapshot.exists()) {
            document.getElementById("monthlyFees").innerHTML = '<li>No fee records found for this student. (Admin must approve student first)</li>';
            return;
        }
        
        var html = '<ul class="fee-list">';
        var fees = snapshot.val();
        
        chronologicalMonths.forEach(function(month) {
            if (fees.hasOwnProperty(month)) {
                
                let statusData = fees[month];
                let dateMethodDisplay = '';
                let status = 'unpaid';

                // Determine current status and display info
                if (typeof statusData === 'object' && statusData !== null && statusData.status) {
                    dateMethodDisplay = ` (Date: ${statusData.date}, Method: ${statusData.method})`;
                    status = statusData.status;
                } else if (typeof statusData === 'string') {
                    status = statusData; 
                }

                var statusClass = getStatusClass(status);
                var statusText = `<span class="${statusClass}">${status}</span>`;

                html += '<li class="fee-item">' + month + ': ' + statusText + dateMethodDisplay + ' ';
                
                // Admin Buttons
                // Mark Break button always visible unless status is already break
                if(status !== 'break') {
                    html += `<button class="break-btn" onclick="markMonthBreak('${studentId}','${month}')">Mark Break</button>`;
                }
                
                // Mark Paid button visible only if not paid and not break
                if(status !== 'paid' && status !== 'break') {
                    html += `<button class="mark-paid-btn" onclick="markMonthPaid('${studentId}','${month}')">Mark Paid</button>`;
                }

                html += '</li>';
            }
        });

        document.getElementById("monthlyFees").innerHTML = html + '</ul>';
    });
}

function markMonthPaid(studentId, month) {
    if (!auth || !auth.currentUser) return logout();
    
    let method = prompt("Enter payment method for " + month + " (bKash, Nagad, or Cash):");
    
    if (!method) {
        // Use custom message box in final version
        alert("Payment method is required. Payment canceled.");
        return;
    }
    
    const paymentRecord = {
        status: "paid",
        date: getCurrentDate(),
        method: method.trim()
    };
    
    database.ref('students/' + studentId + '/fees/' + month).set(paymentRecord, function(error) {
        if (error) {
            console.error(error);
            alert("❌ Payment failed.");
        } else {
            // Note: loadStudentFees(studentId) is called automatically because we used on('value')
            alert("Payment for " + month + " recorded successfully!");
        }
    });
}

function markMonthBreak(studentId, month) {
    if (!auth || !auth.currentUser) return logout();
    // Set status directly to "break" (string value)
    database.ref('students/' + studentId + '/fees/' + month).set("break", function(error) {
        if (error) {
            console.error(error);
            alert("❌ Mark break failed.");
        }
        // Note: loadStudentFees(studentId) is called automatically because we used on('value')
    });
}


// --- STUDENT DASHBOARD FUNCTIONS ---

function loadStudentDashboard(studentId) {
    var chronologicalMonths = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    
    var currentDate = new Date();
    var currentMonthIndex = currentDate.getMonth(); // 0 (Jan) to 11 (Dec)
    
    // Use on() to get real-time updates for the dashboard
    database.ref('students/' + studentId).on('value', function(snapshot) {
        if (!snapshot.exists()) return logout(); // Log out if student record disappears

        var student = snapshot.val();

        // 1. SCHOOL NAME AND ACADEMIC YEAR (Header)
        const studentNameElement = document.getElementById("studentName");
        if (studentNameElement) {
            var headerHTML = '<h2>The Academic Care</h2>';
            headerHTML += '<p><strong>Academic Year:</strong> 2025</p>';
            studentNameElement.innerHTML = headerHTML;
        }
        
        // 2. MY PROFILE CONTENT
        const profileContentElement = document.getElementById("profileContent");
        if (profileContentElement) {
            var profileContentHTML = '';
            profileContentHTML += '<p><strong>Student Name:</strong> ' + student.name + '</p>';
            profileContentHTML += '<p><strong>Class:</strong> ' + student.class + '</p>';
            profileContentHTML += '<p><strong>Roll:</strong> ' + student.roll + '</p>';
            profileContentHTML += '<p><strong>Guardian No:</strong> ' + student.guardian + '</p>';
            profileContentElement.innerHTML = profileContentHTML;
        }

        // 3. TUITION FEE STATUS CONTENT (Only show up to the current month)
        const feesContentElement = document.getElementById("feesContent");
        if (feesContentElement) {
            var feesContentHTML = '<ul class="fee-list">';
            var fees = student.fees || {}; 
            
            for (let i = 0; i <= currentMonthIndex; i++) {
                var month = chronologicalMonths[i];
                
                if (fees.hasOwnProperty(month)) {
                    
                    let statusData = fees[month];
                    let dateDisplay = '';
                    let status = 'unpaid';

                    if (typeof statusData === 'object' && statusData !== null && statusData.status) {
                        dateDisplay = ` (Paid on: ${statusData.date})`;
                        status = statusData.status;
                    } else if (typeof statusData === 'string') {
                        status = statusData; 
                    }

                    var statusClass = getStatusClass(status); 
                    
                    feesContentHTML += '<li>' + month + ': <span class="' + statusClass + '">' + status + dateDisplay + '</span></li>';
                }
            }
            
            feesContentHTML += '</ul>';
            
            feesContentElement.innerHTML = feesContentHTML;
        }
    }); // Catch handled globally by login function initial catch block
}
