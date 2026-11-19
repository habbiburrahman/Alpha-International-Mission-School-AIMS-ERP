
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const teacherSelect = document.getElementById("teacher");
const dateInput = document.getElementById("attendanceDate");
const statusSelect = document.getElementById("status");
const remarksInput = document.getElementById("remarks");
const saveButton = document.getElementById("saveAttendance");
const message = document.getElementById("message");
const attendanceList = document.getElementById("attendanceList");

let teachers = [];

dateInput.value = new Date().toLocaleDateString("en-CA");

async function checkAdmin() {
    const { data: sessionData } = await db.auth.getSession();

    if (!sessionData.session) {
        alert("Please login as Admin first.");
        window.location.href = "index.html";
        return false;
    }

    const { data, error } = await db.rpc("is_admin");

    if (error || !data) {
        alert("Only Admin can manage teacher attendance.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadTeachers() {
    const { data, error } = await db
        .from("teachers")
        .select("id, teacher_name")
        .order("teacher_name");

    if (error) {
        message.textContent = error.message;
        return;
    }

    teachers = data || [];

    teacherSelect.innerHTML =
        '<option value="">Select Teacher</option>';

    teachers.forEach(teacher => {
        const option = document.createElement("option");
        option.value = teacher.id;
        option.textContent = teacher.teacher_name;
        teacherSelect.appendChild(option);
    });
}

async function loadAttendance() {
    const { data, error } = await db
        .from("teacher_attendance")
        .select("id, teacher_id, attendance_date, status, remarks")
        .order("attendance_date", { ascending: false });

    if (error) {
        attendanceList.innerHTML =
            '<tr><td colspan="5">Error: ' + error.message + '</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        attendanceList.innerHTML =
            '<tr><td colspan="5">No attendance records found</td></tr>';
        return;
    }

    attendanceList.innerHTML = "";

    data.forEach(record => {
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

        const actionCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.type = "button";

        editButton.addEventListener("click", () => {
            teacherSelect.value = record.teacher_id;
            dateInput.value = record.attendance_date;
            statusSelect.value = record.status;
            remarksInput.value = record.remarks || "";

            saveButton.textContent = "Update Attendance";
            message.textContent = "Editing attendance record.";
            message.style.color = "blue";

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        });

        actionCell.appendChild(editButton);
        row.appendChild(actionCell);

        attendanceList.appendChild(row);
    });
}

async function saveAttendance() {
    const teacherId = teacherSelect.value;
    const attendanceDate = dateInput.value;
    const status = statusSelect.value;
    const remarks = remarksInput.value.trim();

    if (!teacherId || !attendanceDate || !status) {
        message.textContent = "Please fill all required fields.";
        message.style.color = "red";
        return;
    }

    saveButton.disabled = true;

    const { data: sessionData } = await db.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
        message.textContent = "Please login again.";
        message.style.color = "red";
        saveButton.disabled = false;
        return;
    }

    const { error } = await db
        .from("teacher_attendance")
        .upsert(
            {
                teacher_id: Number(teacherId),
                attendance_date: attendanceDate,
                status: status,
                remarks: remarks || null,
                marked_by: user.id
            },
            {
                onConflict: "teacher_id,attendance_date"
            }
        );

    saveButton.disabled = false;

    if (error) {
        message.textContent = "Attendance error: " + error.message;
        message.style.color = "red";
        return;
    }

    message.textContent = "Attendance saved successfully!";
    message.style.color = "green";

    remarksInput.value = "";
    saveButton.textContent = "Save Attendance";

    await loadAttendance();
}

saveButton.addEventListener("click", saveAttendance);

async function initializePage() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    await loadTeachers();
    await loadAttendance();
}

initializePage();