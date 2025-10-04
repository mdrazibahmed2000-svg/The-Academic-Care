// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCHMl5grIOPL5NbQnUMDT5y2U_BSacoXh8",
  authDomain: "the-academic-care.firebaseapp.com",
  databaseURL: "https://the-academic-care-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "the-academic-care",
  storageBucket: "the-academic-care.firebasestorage.app",
  messagingSenderId: "728354914429",
  appId: "1:728354914429:web:9fe92ca6476baf6af2f114",
  measurementId: "G-37MDWVYWFJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// DOM Elements
const userID = document.getElementById("userID");
const adminLoginFields = document.getElementById("adminLoginFields");
const loginBtn = document.getElementById("loginBtn");
const applyBtn = document.getElementById("applyBtn");
const messageDiv = document.getElementById("message");

const registrationContainer = document.getElementById("registrationContainer");
const loginContainer = document.getElementById("loginContainer");
const backToLogin = document.getElementById("backToLogin");
const registrationForm = document.getElementById("registrationForm");
const studentIDDisplay = document.getElementById("studentIDDisplay");

const studentPanel = document.getElementById("studentPanel");
const profileBtn = document.getElementById("profileBtn");
const tuitionBtn = document.getElementById("tuitionBtn");
const breakBtn = document.getElementById("breakBtn");
const profileSection = document.getElementById("profile");
const profileInfo = document.getElementById("profile");
const tuitionSection = document.getElementById("tuition");
const tuitionTable = document.getElementById("tuitionTable");
const breakSection = document.getElementById("break");
const breakMonthsInput = document.getElementById("breakMonths");
const requestBreakBtn = document.getElementById("requestBreakBtn");
const breakMessage = document.getElementById("breakMessage");

const adminPanel = document.getElementById("adminPanel");
const tabBtns = document.querySelectorAll(".tabBtn");
const tabContents = document.querySelectorAll(".tabContent");
const pendingStudentsList = document.getElementById("pendingStudents");
const classLists = {
    "07": document.getElementById("class07Students"),
    "08": document.getElementById("class08Students"),
    "09": document.getElementById("class09Students")
};
const studentInfoDiv = document.getElementById("studentInfo");
const studentTuitionTable = document.getElementById("studentTuitionTable");

// Show admin fields if "admin" typed
userID.addEventListener("input", () => {
    adminLoginFields.classList.toggle("hidden", userID.value.trim().toLowerCase() !== "admin");
});

// LOGIN BUTTON
loginBtn.addEventListener("click", async () => {
    const id = userID.value.trim();
    messageDiv.textContent = "";

    if (id.toLowerCase() === "admin") {
        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        if(!email || !password){ messageDiv.textContent="Enter email/password"; return; }
        try {
            await signInWithEmailAndPassword(auth,email,password);
            loginContainer.classList.add("hidden");
            adminPanel.classList.remove("hidden");
            loadAdminData();
        } catch(e){ messageDiv.textContent=e.message; }
    } else {
        try {
            const snapshot = await get(child(ref(db), `students/${id}`));
            if(snapshot.exists() && snapshot.val().approved){
                loginContainer.classList.add("hidden");
                loadStudentPanel(snapshot.val());
            } else messageDiv.textContent="Student not found or not approved";
        } catch(e){ messageDiv.textContent=e.message; }
    }
});

// APPLY BUTTON
applyBtn.addEventListener("click",()=>{ loginContainer.classList.add("hidden"); registrationContainer.classList.remove("hidden"); });
backToLogin.addEventListener("click",()=>{ registrationContainer.classList.add("hidden"); loginContainer.classList.remove("hidden"); });

// REGISTRATION
registrationForm.addEventListener("submit", async e=>{
    e.preventDefault();
    const name=document.getElementById("name").value.trim();
    const studentClass=document.getElementById("class").value.trim();
    const roll=document.getElementById("roll").value.trim();
    const guardian=document.getElementById("guardian").value.trim();
    const studentID = `S2025${studentClass}${roll}`;
    const studentData = {
        id: studentID,
        name, class:studentClass, roll, guardian,
        approved:false,
        tuitionStatus:{
            January:{paid:false,date:null},February:{paid:false,date:null},
            March:{paid:false,date:null},April:{paid:false,date:null},
            May:{paid:false,date:null},June:{paid:false,date:null},
            July:{paid:false,date:null},August:{paid:false,date:null},
            September:{paid:false,date:null},October:{paid:false,date:null},
            November:{paid:false,date:null},December:{paid:false,date:null}
        },
        breakRequested:0
    };
    await set(ref(db,`students/${studentID}`),studentData);
    studentIDDisplay.innerHTML=`Registration submitted! Your Student ID: <strong>${studentID}</strong>`;
    registrationForm.reset();
});

// STUDENT PANEL
function loadStudentPanel(student) {
    studentPanel.classList.remove("hidden");
    profileBtn.addEventListener("click", () => {
        hideAllSections(); profileSection.classList.remove("hidden");
        profileInfo.innerHTML = `
            <strong>Name:</strong> ${student.name}<br>
            <strong>Class:</strong> ${student.class}<br>
            <strong>Roll:</strong> ${student.roll}<br>
            <strong>Guardian:</strong> ${student.guardian}<br>
            <strong>Student ID:</strong> ${student.id}
        `;
    });
    tuitionBtn.addEventListener("click", () => {
        hideAllSections(); tuitionSection.classList.remove("hidden");
        tuitionTable.innerHTML = "";
        Object.entries(student.tuitionStatus).forEach(([month,data]) => {
            const tr = document.createElement("tr");
            const statusClass = data.paid ? "paid" : "unpaid";
            const statusText = data.paid ? `Paid (${data.date})` : "Unpaid";
            tr.innerHTML = `<td>${month}</td><td class="${statusClass}">${statusText}</td>`;
            tuitionTable.appendChild(tr);
        });
    });
    breakBtn.addEventListener("click", () => { hideAllSections(); breakSection.classList.remove("hidden"); });
    requestBreakBtn.addEventListener("click", async () => {
        const months = parseInt(breakMonthsInput.value);
        if (months > 0) {
            await update(ref(db, `students/${student.id}`), { breakRequested: months });
            breakMessage.textContent = `Break requested for ${months} month(s)`;
        }
    });
}

function hideAllSections() {
    profileSection.classList.add("hidden");
    tuitionSection.classList.add("hidden");
    breakSection.classList.add("hidden");
}

// ADMIN PANEL
tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        tabContents.forEach(c => c.classList.add("hidden"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        document.getElementById(tab).classList.remove("hidden");
    });
});

// Load Admin Data
async function loadAdminData() {
    const snapshot = await get(ref(db,"students"));
    pendingStudentsList.innerHTML = "";
    Object.values(classLists).forEach(list => list.innerHTML = "");

    snapshot.forEach(doc => {
        const student = doc.val();
        // Pending
        if(!student.approved){
            const li = document.createElement("li");
            li.textContent = `${student.name} (${student.id})`;
            const approveBtn = document.createElement("button");
            approveBtn.textContent = "Approve";
            approveBtn.addEventListener("click", async () => {
                await update(ref(db, `students/${student.id}`), {approved:true});
                loadAdminData();
            });
            li.appendChild(approveBtn);
            pendingStudentsList.appendChild(li);
        }
        // Approved by class
        if(student.approved){
            const li = document.createElement("li");
            li.textContent = `${student.name} (${student.id})`;
            li.addEventListener("click", ()=> showStudentDetail(student));
            if(classLists[student.class]) classLists[student.class].appendChild(li);
        }
    });
}

// Show student detail in admin panel
function showStudentDetail(student){
    tabContents.forEach(c => c.classList.add("hidden"));
    document.getElementById("studentDetail").classList.remove("hidden");
    studentInfoDiv.innerHTML = `
        <strong>Name:</strong> ${student.name}<br>
        <strong>Class:</strong> ${student.class}<br>
        <strong>Roll:</strong> ${student.roll}<br>
        <strong>Guardian:</strong> ${student.guardian}<br>
        <strong>Student ID:</strong> ${student.id}<br>
        <strong>Break Requested:</strong> ${student.breakRequested} month(s)
    `;
    studentTuitionTable.innerHTML = "";
    Object.entries(student.tuitionStatus).forEach(([month,data])=>{
        const tr = document.createElement("tr");
        const statusText = data.paid ? `Paid (${data.date})` : "Unpaid";
        const actionBtn = document.createElement("button");
        actionBtn.textContent = data.paid ? "Mark Unpaid" : "Mark Paid";
        actionBtn.addEventListener("click", async ()=>{
            await update(ref(db, `students/${student.id}/tuitionStatus/${month}`), {
                paid: !data.paid,
                date: !data.paid ? new Date().toLocaleDateString() : null
            });
            loadAdminData();
            showStudentDetail({...student, tuitionStatus:{...student.tuitionStatus, [month]:{paid:!data.paid,date:!data.paid?new Date().toLocaleDateString():null}}});
        });
        tr.innerHTML = `<td>${month}</td><td>${statusText}</td>`;
        const tdAction = document.createElement("td");
        tdAction.appendChild(actionBtn);
        tr.appendChild(tdAction);
        studentTuitionTable.appendChild(tr);
    });
}
