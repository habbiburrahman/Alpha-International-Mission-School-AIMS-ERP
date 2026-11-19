const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const dateFilter = document.getElementById("dateFilter");
const message = document.getElementById("message");

const today = new Date().toLocaleDateString("en-CA");
dateFilter.value = today;

async function checkAdmin() {
    const { data: { user }, error } =
        await supabaseClient.auth.getUser();

    if (error || !user) {
        window.location.href = "index.html";
        return false;
    }

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

    if (profileError || profile.role !== "admin") {
        message.textContent = "Access denied. Admin only.";
        document.getElementById("loadBtn").disabled = true;
        return false;
    }

    return true;
}

function updateSummary(records) {
    const total = records.length;

    const present = records.filter(
        r => r.status?.toLowerCase() === "present"
    ).length;

    const absent = records.filter(
        r => r.status?.toLowerCase() === "absent"
    ).length;

    const late = records.filter(
        r => r.status?.toLowerCase() === "late"
    ).length;

    const leave = records.filter(
        r => r.status?.toLowerCase() === "leave"
    ).length;

    const percentage = total > 0
        ? ((present + late) / total) * 100
        : 0;

    document.getElementById("totalCount").textContent = total;
    document.getElementById("presentCount").textContent = present;
    document.getElementById("absentCount").textContent = absent;
    document.getElementById("lateCount").textContent = late;
    document.getElementById("leaveCount").textContent = leave;

    document.getElementById("attendancePercentage").textContent =
        percentage.toFixed(1) + "%";

    document.getElementById("progressBar").style.width =
        percentage.toFixed(1) + "%";
}

async function loadSummary() {
    const selectedDate = dateFilter.value;

    if (!selectedDate) {
        message.textContent = "Please select a date.";
        return;
    }

    message.textContent = "Loading attendance summary...";

    const { data, error } = await supabaseClient
        .from("attendance")
        .select("id, status, attendance_date")
        .eq("attendance_date", selectedDate);

    if (error) {
        message.textContent = "Error: " + error.message;
        updateSummary([]);
        return;
    }

    updateSummary(data || []);

    message.textContent = data.length > 0
        ? "Attendance summary loaded successfully."
        : "No attendance records found for this date.";
}

document.getElementById("loadBtn").addEventListener(
    "click",
    loadSummary
);

async function init() {
    const isAdmin = await checkAdmin();

    if (isAdmin) {
        await loadSummary();
    }
}

init();