const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const tableBody = document.getElementById("recordsTableBody");
const message = document.getElementById("message");
const totalRecords = document.getElementById("totalRecords");

let allRecords = [];

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
        tableBody.innerHTML = "";
        return false;
    }

    return true;
}

async function loadAttendanceRecords() {
    message.textContent = "Loading attendance records...";

    const { data: attendance, error } = await supabaseClient
        .from("attendance")
        .select("id, enrollment_id, attendance_date, status, remarks")
        .order("attendance_date", { ascending: false });

    if (error) {
        message.textContent = "Error: " + error.message;
        return;
    }

    if (!attendance || attendance.length === 0) {
        allRecords = [];
        displayRecords([]);
        message.textContent = "No attendance records found.";
        return;
    }

    const enrollmentIds = [
        ...new Set(attendance.map(record => record.enrollment_id))
    ];

    const { data: enrollments, error: enrollmentError } =
        await supabaseClient
            .from("enrollments")
            .select("id, student_id, section_id, roll_number")
            .in("id", enrollmentIds);

    if (enrollmentError) {
        message.textContent = "Enrollment Error: " + enrollmentError.message;
        return;
    }

    const studentIds = [...new Set(enrollments.map(e => e.student_id))];
    const sectionIds = [...new Set(enrollments.map(e => e.section_id))];

    const { data: students, error: studentError } =
        await supabaseClient
            .from("students")
            .select("id, student_name, admission_number")
            .in("id", studentIds);

    if (studentError) {
        message.textContent = "Student Error: " + studentError.message;
        return;
    }

    const { data: sections, error: sectionError } =
        await supabaseClient
            .from("sections")
            .select("id, section_name, class_id")
            .in("id", sectionIds);

    if (sectionError) {
        message.textContent = "Section Error: " + sectionError.message;
        return;
    }

    const classIds = [...new Set(sections.map(s => s.class_id))];

    const { data: classes, error: classError } =
        await supabaseClient
            .from("classes")
            .select("id, class_name")
            .in("id", classIds);

    if (classError) {
        message.textContent = "Class Error: " + classError.message;
        return;
    }

    allRecords = attendance.map(record => {
        const enrollment = enrollments.find(
            e => e.id === record.enrollment_id
        );

        const student = students.find(
            s => s.id === enrollment?.student_id
        );

        const section = sections.find(
            s => s.id === enrollment?.section_id
        );

        const classInfo = classes.find(
            c => c.id === section?.class_id
        );

        return {
            ...record,
            student_name: student?.student_name || "Unknown",
            admission_number: student?.admission_number || "-",
            section_name: section?.section_name || "-",
            class_name: classInfo?.class_name || "-",
            roll_number: enrollment?.roll_number || "-"
        };
    });

    displayRecords(allRecords);
    message.textContent = "Attendance records loaded successfully.";
}

function displayRecords(records) {
    tableBody.innerHTML = "";

    if (records.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8">No records found.</td>
            </tr>
        `;
    } else {
        records.forEach(record => {
            const row = document.createElement("tr");

            const values = [
                record.attendance_date,
                record.student_name,
                record.admission_number,
                record.class_name,
                record.section_name,
                record.roll_number,
                record.status,
                record.remarks || "-"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            tableBody.appendChild(row);
        });
    }

    totalRecords.textContent = "Total Records: " + records.length;
}

document.getElementById("filterBtn").addEventListener("click", () => {
    const selectedDate = document.getElementById("dateFilter").value;
    const selectedStatus = document.getElementById("statusFilter").value;

    const filtered = allRecords.filter(record => {
        const dateMatch = !selectedDate ||
            record.attendance_date === selectedDate;

        const statusMatch = !selectedStatus ||
            record.status === selectedStatus;

        return dateMatch && statusMatch;
    });

    displayRecords(filtered);
    message.textContent = "Filter applied.";
});

document.getElementById("resetBtn").addEventListener("click", () => {
    document.getElementById("dateFilter").value = "";
    document.getElementById("statusFilter").value = "";

    displayRecords(allRecords);
    message.textContent = "Filters reset.";
});

async function init() {
    const isAdmin = await checkAdmin();

    if (isAdmin) {
        await loadAttendanceRecords();
    }
}

init();