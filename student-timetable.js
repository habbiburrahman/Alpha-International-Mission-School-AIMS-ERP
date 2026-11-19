
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const timetableBody = document.getElementById("timetableBody");

async function loadTimetable() {
    try {
        const { data: { session }, error: sessionError } =
            await db.auth.getSession();

        if (sessionError || !session) {
            window.location.href = "index.html";
            return;
        }

        const userId = session.user.id;

        // Check Student / Parent role
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (
            profileError ||
            !profile ||
            !["student", "parent"].includes(profile.role)
        ) {
            timetableBody.innerHTML =
                `<tr><td colspan="5">Access denied.</td></tr>`;
            return;
        }

        let studentId;

        // Get Student ID
        if (profile.role === "student") {
            const { data: student, error } = await db
                .from("students")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (error || !student) {
                throw new Error("Student record not found.");
            }

            studentId = student.id;

        } else {
            // Get Parent ID
            const { data: parent, error } = await db
                .from("parents")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (error || !parent) {
                throw new Error("Parent record not found.");
            }

            // Get linked Student
            const { data: link, error: linkError } = await db
                .from("student_parents")
                .select("student_id")
                .eq("parent_id", parent.id)
                .limit(1)
                .maybeSingle();

            if (linkError || !link) {
                throw new Error("Linked student not found.");
            }

            studentId = link.student_id;
        }

        // Get Student Enrollment
        const { data: enrollment, error: enrollmentError } = await db
            .from("enrollments")
            .select(`
                section_id,
                sections (
                    section_name,
                    classes (class_name)
                )
            `)
            .eq("student_id", studentId)
            .limit(1)
            .maybeSingle();

        if (enrollmentError || !enrollment) {
            throw new Error("Student enrollment not found.");
        }

        const section = enrollment.sections;

        document.getElementById("studentClass").textContent =
            section?.classes?.class_name || "N/A";

        document.getElementById("studentSection").textContent =
            section?.section_name || "N/A";

        // Get Timetable without directly joining private teachers table
        const { data: timetable, error: timetableError } = await db
            .from("timetables")
            .select(`
                day_of_week,
                period_number,
                start_time,
                end_time,
                teacher_id,
                subjects (subject_name)
            `)
            .eq("section_id", enrollment.section_id);

        if (timetableError) {
            throw timetableError;
        }

        if (!timetable || timetable.length === 0) {
            timetableBody.innerHTML =
                `<tr><td colspan="5">No timetable available.</td></tr>`;
            return;
        }

        // Collect unique teacher IDs
        const teacherIds = [
            ...new Set(
                timetable
                    .map(item => item.teacher_id)
                    .filter(id => id !== null && id !== undefined)
            )
        ];

        // Get only safe teacher information from teacher_directory
        let teacherMap = {};

        if (teacherIds.length > 0) {
            const { data: teachers, error: teacherError } = await db
                .from("teacher_directory")
                .select("id, teacher_name, subject")
                .in("id", teacherIds);

            if (teacherError) {
                throw new Error(
                    "Unable to load teacher directory: " +
                    teacherError.message
                );
            }

            teachers.forEach(teacher => {
                teacherMap[teacher.id] = teacher;
            });
        }

        // Sort timetable by day and period
        const dayOrder = {
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
            Sunday: 7
        };

        timetable.sort((a, b) =>
            (dayOrder[a.day_of_week] || 8) -
            (dayOrder[b.day_of_week] || 8) ||
            a.period_number - b.period_number
        );

        // Display timetable safely
        timetableBody.innerHTML = "";

        timetable.forEach(item => {
            const teacher = teacherMap[item.teacher_id];

            const row = document.createElement("tr");

            const values = [
                item.day_of_week || "-",
                item.period_number ?? "-",
                `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`,
                item.subjects?.subject_name || "-",
                teacher?.teacher_name || "-"
            ];

            values.forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            timetableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Timetable error:", error);

        timetableBody.innerHTML = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent =
            "Unable to load timetable: " + error.message;

        row.appendChild(cell);
        timetableBody.appendChild(row);
    }
}

// Format time
function formatTime(time) {
    if (!time) return "-";

    const [hour, minute] = time.split(":");
    const h = Number(hour);
    const suffix = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
}

loadTimetable();
