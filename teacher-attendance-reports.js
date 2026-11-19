const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const reportDate = document.getElementById("reportDate");
const reportMonth = document.getElementById("reportMonth");
const reportList = document.getElementById("reportList");
const reportMessage = document.getElementById("reportMessage");

let teachers = [];

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

async function checkAdmin() {
    const { data: sessionData } = await db.auth.getSession();

    if (!sessionData.session) {
        alert("Please login as Admin first.");
        window.location.href = "index.html";
        return false;
    }

    const { data, error } = await db.rpc("is_admin");

    if (error || !data) {
        alert("Access denied. Admin only.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadTeachers() {
    const { data, error } = await db
        .from("teachers")
        .select("id, teacher_name");

    if (error) {
        reportMessage.textContent = error.message;
        return false;
    }

    teachers = data || [];
    return true;
}

function showSummary(records) {
    const counts = {
        Present: 0,
        Absent: 0,
        Late: 0,
        "Half Day": 0,
        Leave: 0
    };

    records.forEach(record => {
        if (counts[record.status] !== undefined) {
            counts[record.status]++;
        }
    });

    document.getElementById("totalCount").textContent = records.length;
    document.getElementById("presentCount").textContent = counts.Present;
    document.getElementById("absentCount").textContent = counts.Absent;
    document.getElementById("lateCount").textContent = counts.Late;
    document.getElementById("halfDayCount").textContent = counts["Half Day"];
    document.getElementById("leaveCount").textContent = counts.Leave;
}

function showRecords(records) {
    reportList.innerHTML = "";

    if (records.length === 0) {
        reportList.innerHTML =
            '<tr><td colspan="4">No attendance records found.</td></tr>';
        return;
    }

    records.forEach(record => {
        const teacher = teachers.find(
            item => item.id === record.teacher_id
        );

        const row = document.createElement("tr");

        const values = [
            teacher ? teacher.teacher_name : "Unknown Teacher",
            record.attendance_date,
            record.status,
            record.remarks || "-"
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        reportList.appendChild(row);
    });
}

async function fetchReport(startDate, endDate) {
    reportMessage.textContent = "Loading report...";

    const { data, error } = await db
        .from("teacher_attendance")
        .select("teacher_id, attendance_date, status, remarks")
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate)
        .order("attendance_date", { ascending: false });

    if (error) {
        reportMessage.textContent = "Report error: " + error.message;
        return;
    }

    const records = data || [];

    showSummary(records);
    showRecords(records);

    reportMessage.textContent =
        `Report loaded successfully. Total records: ${records.length}`;
}

document.getElementById("dailyReport").addEventListener("click", () => {
    const date = reportDate.value;

    if (!date) {
        reportMessage.textContent = "Please select a date.";
        return;
    }

    fetchReport(date, date);
});

document.getElementById("monthlyReport").addEventListener("click", () => {
    const month = reportMonth.value;

    if (!month) {
        reportMessage.textContent = "Please select a month.";
        return;
    }

    const [year, monthNumber] = month.split("-").map(Number);

    const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;

    const lastDay = new Date(year, monthNumber, 0).getDate();

    const endDate =
        `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    fetchReport(startDate, endDate);
});

async function initializePage() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    reportDate.value = getTodayDate();
    reportMonth.value = getTodayDate().slice(0, 7);

    const loaded = await loadTeachers();

    if (!loaded) return;

    reportMessage.textContent =
        "Select a date or month to view attendance reports.";
}

initializePage();