
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const classSelect = document.getElementById("classSelect");
const sectionSelect = document.getElementById("sectionSelect");
const attendanceDate = document.getElementById("attendanceDate");
const tableBody = document.getElementById("attendanceTableBody");
const saveBtn = document.getElementById("saveAttendanceBtn");
const message = document.getElementById("message");

let studentsList = [];
let currentUserId = null;

// Set today's date
attendanceDate.value = new Date().toISOString().split("T")[0];

// CHECK ADMIN LOGIN
async function checkAdmin() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "index.html";
        return false;
    }

    currentUserId = data.session.user.id;

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", currentUserId)
        .single();

    if (profileError || profile?.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// LOAD CLASSES
async function loadClasses() {
    const { data, error } = await supabaseClient
        .from("classes")
        .select("id, class_name")
        .order("id");

    if (error) {
        message.textContent = "Class error: " + error.message;
        return;
    }

    classSelect.innerHTML = '<option value="">Select Class</option>';

    (data || []).forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.class_name;
        classSelect.appendChild(option);
    });
}

// LOAD SECTIONS
async function loadSections() {
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    sectionSelect.disabled = true;

    studentsList = [];
    tableBody.innerHTML =
        '<tr><td colspan="3">Select class and section first.</td></tr>';

    if (!classSelect.value) return;

    const { data, error } = await supabaseClient
        .from("sections")
        .select("id, section_name")
        .eq("class_id", classSelect.value)
        .order("id");

    if (error) {
        message.textContent = "Section error: " + error.message;
        return;
    }

    (data || []).forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.section_name;
        sectionSelect.appendChild(option);
    });

    sectionSelect.disabled = false;
}

// LOAD STUDENTS
async function loadStudents() {
    tableBody.innerHTML = "";
    studentsList = [];
    message.textContent = "";

    if (!classSelect.value || !sectionSelect.value) {
        tableBody.innerHTML =
            '<tr><td colspan="3">Select class and section first.</td></tr>';
        return;
    }

    const { data, error } = await supabaseClient
        .from("enrollments")
        .select("id, students(id, student_name, admission_number)")
        .eq("section_id", sectionSelect.value);

    if (error) {
        message.textContent = "Student error: " + error.message;
        return;
    }

    studentsList = (data || []).filter(item => item.students);

    if (studentsList.length === 0) {
        tableBody.innerHTML =
            '<tr><td colspan="3">No enrolled students found.</td></tr>';
        return;
    }

    studentsList.forEach(item => {
        const student = item.students;

        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = student.student_name;

        const admissionCell = document.createElement("td");
        admissionCell.textContent = student.admission_number;

        const statusCell = document.createElement("td");
        const statusSelect = document.createElement("select");

        statusSelect.className = "statusSelect";
        statusSelect.dataset.id = item.id;

        ["present", "absent", "late"].forEach(status => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent =
                status.charAt(0).toUpperCase() + status.slice(1);

            statusSelect.appendChild(option);
        });

        statusCell.appendChild(statusSelect);

        row.append(nameCell, admissionCell, statusCell);
        tableBody.appendChild(row);
    });
}

// CLASS AND SECTION EVENTS
classSelect.addEventListener("change", loadSections);
sectionSelect.addEventListener("change", loadStudents);

// SAVE ATTENDANCE
saveBtn.addEventListener("click", async () => {
    message.textContent = "";

    if (!classSelect.value || !sectionSelect.value ||
        studentsList.length === 0) {
        message.textContent = "Please select a class and section with students.";
        return;
    }

    if (!attendanceDate.value) {
        message.textContent = "Please select attendance date.";
        return;
    }

    if (!currentUserId) {
        message.textContent = "Admin session not found. Please login again.";
        return;
    }

    saveBtn.disabled = true;
    message.textContent = "Saving attendance...";

    try {
        const statusSelects = [
            ...tableBody.querySelectorAll(".statusSelect")
        ];

        for (const select of statusSelects) {
            const enrollmentId = Number(select.dataset.id);

            const record = {
                enrollment_id: enrollmentId,
                attendance_date: attendanceDate.value,
                status: select.value,
                marked_by: currentUserId
            };

            // Check whether attendance already exists
            const { data: existing, error: checkError } =
                await supabaseClient
                    .from("attendance")
                    .select("id")
                    .eq("enrollment_id", enrollmentId)
                    .eq("attendance_date", attendanceDate.value)
                    .maybeSingle();

            if (checkError) {
                throw checkError;
            }

            let result;

            if (existing) {
                result = await supabaseClient
                    .from("attendance")
                    .update(record)
                    .eq("id", existing.id);
            } else {
                result = await supabaseClient
                    .from("attendance")
                    .insert(record);
            }

            if (result.error) {
                throw result.error;
            }
        }

        message.textContent = "Attendance saved successfully!";

    } catch (error) {
        message.textContent = "Attendance error: " + error.message;
        console.error("Attendance error:", error);

    } finally {
        saveBtn.disabled = false;
    }
});

// START PAGE
async function startPage() {
    const isAdmin = await checkAdmin();

    if (isAdmin) {
        await loadClasses();
    }
}

startPage();
