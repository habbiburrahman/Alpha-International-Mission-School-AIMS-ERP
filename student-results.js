
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const resultsTable = document.getElementById("resultsTable");

async function loadStudentResults() {
    try {
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData.session;

        if (!session) {
            window.location.href = "student-login.html";
            return;
        }

        const userId = session.user.id;

        // Check student/parent profile
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        if (!["student", "parent"].includes(profile.role)) {
            alert("Access denied. Student or Parent account required.");
            return;
        }

        let studentId;

        if (profile.role === "student") {
            const { data: student, error } = await db
                .from("students")
                .select("id")
                .eq("user_id", userId)
                .single();

            if (error) throw error;
            studentId = student.id;

        } else {
            // Parent: find linked student
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
                .single();

            if (linkError) throw linkError;
            studentId = link.student_id;
        }

        // Fetch marks for this student only
        const { data: marks, error: marksError } = await db
            .from("marks")
            .select(`
                marks_obtained,
                remarks,
                examinations (
                    exam_name,
                    total_marks
                ),
                subjects (
                    subject_name
                )
            `)
            .eq("student_id", studentId);

        if (marksError) throw marksError;

        if (!marks || marks.length === 0) {
            resultsTable.innerHTML = `
                <tr>
                    <td colspan="4">No examination results available.</td>
                </tr>
            `;

            updateSummary(0, 0, 0);
            return;
        }

        let totalObtained = 0;
        let maximumMarks = 0;

        resultsTable.innerHTML = "";

        marks.forEach((item) => {
            const obtained = Number(item.marks_obtained) || 0;
            const maximum = Number(item.examinations?.total_marks) || 0;

            totalObtained += obtained;
            maximumMarks += maximum;

            const row = document.createElement("tr");

            const subjectCell = document.createElement("td");
            subjectCell.textContent =
                `${item.subjects?.subject_name || "Subject"} (${item.examinations?.exam_name || "Exam"})`;

            const obtainedCell = document.createElement("td");
            obtainedCell.textContent = obtained;

            const maximumCell = document.createElement("td");
            maximumCell.textContent = maximum;

            const remarksCell = document.createElement("td");
            remarksCell.textContent = item.remarks || "--";

            row.append(
                subjectCell,
                obtainedCell,
                maximumCell,
                remarksCell
            );

            resultsTable.appendChild(row);
        });

        const percentage = maximumMarks > 0
            ? (totalObtained / maximumMarks) * 100
            : 0;

        updateSummary(totalObtained, maximumMarks, percentage);

    } catch (error) {
        console.error("Results Error:", error);

        resultsTable.innerHTML = `
            <tr>
                <td colspan="4">Unable to load results. Please try again.</td>
            </tr>
        `;
    }
}

function updateSummary(obtained, maximum, percentage) {
    document.getElementById("totalObtained").textContent =
        obtained.toFixed(2);

    document.getElementById("maximumMarks").textContent =
        maximum.toFixed(2);

    document.getElementById("percentage").textContent =
        percentage.toFixed(2) + "%";

    document.getElementById("resultStatus").textContent =
        maximum === 0 ? "--" :
        percentage >= 33 ? "Pass" : "Needs Improvement";
}

loadStudentResults();
