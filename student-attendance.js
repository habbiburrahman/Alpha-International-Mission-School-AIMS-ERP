
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const attendanceTable = document.getElementById("attendanceTable");

const totalDaysElement = document.getElementById("totalDays");
const presentDaysElement = document.getElementById("presentDays");
const absentDaysElement = document.getElementById("absentDays");
const percentageElement = document.getElementById("attendancePercentage");

// ==========================================
// HELPER
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// GET STUDENT ID
// ==========================================

async function getStudentId(userId, role) {

    if (role === "student") {

        const { data, error } = await db
            .from("students")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (error) throw error;

        return data.id;
    }

    if (role === "parent") {

        const { data: parent, error: parentError } = await db
            .from("parents")
            .select("id")
            .eq("user_id", userId)
            .single();

        if (parentError) throw parentError;

        const { data: link, error: linkError } = await db
            .from("student_parents")
            .select("student_id")
            .eq("parent_id", parent.id)
            .limit(1)
            .maybeSingle();

        if (linkError) throw linkError;

        if (!link) {
            throw new Error("No student linked to this parent account.");
        }

        return link.student_id;
    }

    throw new Error("Please login using a Student or Parent account.");
}

// ==========================================
// LOAD ATTENDANCE
// ==========================================

async function loadAttendance() {

    attendanceTable.innerHTML = `
        <tr>
            <td colspan="3">Loading attendance...</td>
        </tr>
    `;

    try {

        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
            window.location.href = "student-login.html";
            return;
        }

        const userId = sessionData.session.user.id;

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        const studentId = await getStudentId(
            userId,
            profile.role
        );

        // GET STUDENT ENROLLMENTS

        const { data: enrollments, error: enrollmentError } = await db
            .from("enrollments")
            .select("id")
            .eq("student_id", studentId);

        if (enrollmentError) throw enrollmentError;

        if (!enrollments || enrollments.length === 0) {
            attendanceTable.innerHTML = `
                <tr>
                    <td colspan="3">No enrollment found.</td>
                </tr>
            `;
            return;
        }

        const enrollmentIds = enrollments.map(item => item.id);

        // GET ATTENDANCE RECORDS

        const { data: records, error: attendanceError } = await db
            .from("attendance")
            .select("attendance_date, status, remarks")
            .in("enrollment_id", enrollmentIds)
            .order("attendance_date", { ascending: false });

        if (attendanceError) throw attendanceError;

        if (!records || records.length === 0) {

            totalDaysElement.textContent = "0";
            presentDaysElement.textContent = "0";
            absentDaysElement.textContent = "0";
            percentageElement.textContent = "0%";

            attendanceTable.innerHTML = `
                <tr>
                    <td colspan="3">No attendance records found yet.</td>
                </tr>
            `;

            return;
        }

        // CALCULATE SUMMARY

        const total = records.length;

        const present = records.filter(item =>
            String(item.status).toLowerCase() === "present"
        ).length;

        const absent = records.filter(item =>
            String(item.status).toLowerCase() === "absent"
        ).length;

        const percentage = total > 0
            ? ((present / total) * 100).toFixed(1)
            : 0;

        totalDaysElement.textContent = total;
        presentDaysElement.textContent = present;
        absentDaysElement.textContent = absent;
        percentageElement.textContent = percentage + "%";

        // DISPLAY ATTENDANCE TABLE

        attendanceTable.innerHTML = "";

        records.forEach(item => {

            const row = document.createElement("tr");

            const status = String(item.status || "Unknown");
            const normalizedStatus = status.toLowerCase();

            let statusClass = "status-other";

            if (normalizedStatus === "present") {
                statusClass = "status-present";
            } else if (normalizedStatus === "absent") {
                statusClass = "status-absent";
            }

            const formattedDate = item.attendance_date
                ? new Date(item.attendance_date + "T00:00:00")
                    .toLocaleDateString("en-IN")
                : "-";

            row.innerHTML = `
                <td>${escapeHTML(formattedDate)}</td>
                <td class="${statusClass}">
                    ${escapeHTML(status)}
                </td>
                <td>${escapeHTML(item.remarks || "-")}</td>
            `;

            attendanceTable.appendChild(row);
        });

        console.log("AIMS Attendance Loaded Successfully");

    } catch (error) {

        console.error("Attendance Error:", error);

        attendanceTable.innerHTML = `
            <tr>
                <td colspan="3">
                    Error: ${escapeHTML(error.message)}
                </td>
            </tr>
        `;
    }
}

// ==========================================
// START
// ==========================================

loadAttendance();
