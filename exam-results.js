
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const resultForm = document.getElementById("resultForm");
const examSelect = document.getElementById("examId");
const studentSelect = document.getElementById("studentId");
const subjectSelect = document.getElementById("subjectId");
const resultsTableBody = document.getElementById("resultsTableBody");
const message = document.getElementById("message");

let exams = [];
let students = [];
let subjects = [];
let results = [];

async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError || !sessionData.session) {
        alert("Please login as Admin first.");
        window.location.href = "index.html";
        return false;
    }

    const { data, error } = await db.rpc("is_admin");

    if (error || !data) {
        alert("Only Admin can manage exam results.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Load exams
async function loadExams() {
    const { data, error } = await db
        .from("exams")
        .select("id, exam_name, exam_date, total_marks, passing_marks")
        .order("exam_date", { ascending: false });

    if (error) {
        console.error(error);
        message.textContent = "Unable to load exams: " + error.message;
        return;
    }

    exams = data || [];

    examSelect.innerHTML = '<option value="">Select Exam</option>';

    exams.forEach(exam => {
        const option = document.createElement("option");
        option.value = exam.id;
        option.textContent = exam.exam_name + " (" + exam.exam_date + ")";
        examSelect.appendChild(option);
    });
}

// Load students
async function loadStudents() {
    const { data, error } = await db
        .from("students")
        .select("id, student_name")
        .order("student_name");

    if (error) {
        console.error(error);
        message.textContent = "Unable to load students: " + error.message;
        return;
    }

    students = data || [];

    studentSelect.innerHTML = '<option value="">Select Student</option>';

    students.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = student.student_name;
        studentSelect.appendChild(option);
    });
}

// Load subjects
async function loadSubjects() {
    const { data, error } = await db
        .from("subjects")
        .select("id, subject_name")
        .order("subject_name");

    if (error) {
        console.error(error);
        message.textContent = "Unable to load subjects: " + error.message;
        return;
    }

    subjects = data || [];

    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.subject_name;
        subjectSelect.appendChild(option);
    });
}

// Automatically fill marks from selected exam
examSelect.addEventListener("change", function() {
    const selectedExam = exams.find(
        exam => Number(exam.id) === Number(this.value)
    );

    if (selectedExam) {
        document.getElementById("totalMarks").value =
            selectedExam.total_marks;

        document.getElementById("passingMarks").value =
            selectedExam.passing_marks;
    } else {
        document.getElementById("totalMarks").value = "";
        document.getElementById("passingMarks").value = "";
    }
});

// Load saved results
async function loadResults() {
    const { data, error } = await db
        .from("exam_results")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error(error);
        message.textContent = "Unable to load results: " + error.message;
        return;
    }

    results = data || [];

    displayResults();
    updateSummary();
}

// Display results
function displayResults() {
    resultsTableBody.innerHTML = "";

    if (results.length === 0) {
        resultsTableBody.innerHTML =
            '<tr><td colspan="9">No results found.</td></tr>';
        return;
    }

    results.forEach(result => {
        const exam = exams.find(
            item => Number(item.id) === Number(result.exam_id)
        );

        const student = students.find(
            item => Number(item.id) === Number(result.student_id)
        );

        const subject = subjects.find(
            item => Number(item.id) === Number(result.subject_id)
        );

        const status =
            Number(result.marks_obtained) >= Number(result.passing_marks)
                ? "Pass"
                : "Fail";

        const row = document.createElement("tr");

        const values = [
            result.id,
            exam?.exam_name || "Unknown",
            student?.student_name || "Unknown",
            subject?.subject_name || "Unknown",
            result.marks_obtained,
            result.total_marks,
            result.passing_marks,
            status
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";
        deleteButton.type = "button";

        deleteButton.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to delete this result?")) {
                return;
            }

            const { error } = await db
                .from("exam_results")
                .delete()
                .eq("id", result.id);

            if (error) {
                alert("Delete error: " + error.message);
                return;
            }

            await loadResults();
        });

        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);

        resultsTableBody.appendChild(row);
    });
}

// Update summary cards
function updateSummary() {
    const passed = results.filter(
        result =>
            Number(result.marks_obtained) >= Number(result.passing_marks)
    ).length;

    document.getElementById("totalResults").textContent =
        results.length;

    document.getElementById("passedResults").textContent =
        passed;

    document.getElementById("failedResults").textContent =
        results.length - passed;
}

// Save student result
resultForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const examId = Number(examSelect.value);
    const studentId = Number(studentSelect.value);
    const subjectId = Number(subjectSelect.value);

    const marksObtained = Number(
        document.getElementById("marksObtained").value
    );

    const totalMarks = Number(
        document.getElementById("totalMarks").value
    );

    const passingMarks = Number(
        document.getElementById("passingMarks").value
    );

    const remarks = document.getElementById("remarks").value.trim();

    if (
        !examId || !studentId || !subjectId ||
        !Number.isFinite(marksObtained) ||
        !Number.isFinite(totalMarks) ||
        !Number.isFinite(passingMarks) ||
        totalMarks <= 0 ||
        passingMarks < 0 ||
        passingMarks > totalMarks ||
        marksObtained < 0 ||
        marksObtained > totalMarks
    ) {
        message.textContent = "Please enter valid result details.";
        return;
    }

    const resultData = {
        exam_id: examId,
        student_id: studentId,
        subject_id: subjectId,
        marks_obtained: marksObtained,
        total_marks: totalMarks,
        passing_marks: passingMarks,
        remarks: remarks || null
    };

    const { error } = await db
        .from("exam_results")
        .insert([resultData]);

    if (error) {
        console.error(error);
        message.textContent = "Error: " + error.message;
        return;
    }

    message.textContent = "Result saved successfully!";

    resultForm.reset();

    await loadResults();
});

// Start page
async function initializeResults() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    await loadExams();
    await loadStudents();
    await loadSubjects();
    await loadResults();
}

initializeResults();
