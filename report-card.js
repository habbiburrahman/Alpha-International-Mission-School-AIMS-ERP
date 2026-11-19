
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const studentSelect = document.getElementById("studentId");
const examSelect = document.getElementById("examId");
const generateButton = document.getElementById("generateReport");
const reportCard = document.getElementById("reportCard");
const message = document.getElementById("message");

let students = [];
let exams = [];
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
        alert("Only Admin can access report cards.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadStudents() {
    const { data, error } = await db
        .from("students")
        .select("id, student_name, admission_number")
        .order("student_name");

    if (error) {
        message.textContent = "Student error: " + error.message;
        return false;
    }

    students = data || [];

    students.forEach(student => {
        const option = document.createElement("option");
        option.value = student.id;
        option.textContent = student.student_name;
        studentSelect.appendChild(option);
    });

    return true;
}

async function loadExams() {
    const { data, error } = await db
        .from("exams")
        .select("id, exam_name, exam_date")
        .order("exam_date", { ascending: false });

    if (error) {
        message.textContent = "Exam error: " + error.message;
        return false;
    }

    exams = data || [];

    exams.forEach(exam => {
        const option = document.createElement("option");
        option.value = exam.id;
        option.textContent = exam.exam_name;
        examSelect.appendChild(option);
    });

    return true;
}

async function loadSubjects() {
    const { data, error } = await db
        .from("subjects")
        .select("id, subject_name");

    if (error) {
        message.textContent = "Subject error: " + error.message;
        return false;
    }

    subjects = data || [];
    return true;
}

function displayReportCard() {
    const studentId = Number(studentSelect.value);
    const examId = Number(examSelect.value);

    const student = students.find(
        item => Number(item.id) === studentId
    );

    const exam = exams.find(
        item => Number(item.id) === examId
    );

    if (!student || !exam) {
        message.textContent = "Please select student and exam.";
        return;
    }

    const studentResults = results.filter(
        result =>
            Number(result.student_id) === studentId &&
            Number(result.exam_id) === examId
    );

    if (studentResults.length === 0) {
        message.textContent = "No results found for this student and exam.";
        reportCard.hidden = true;
        return;
    }

    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = "";

    let obtainedTotal = 0;
    let maximumTotal = 0;
    let overallPass = true;

    studentResults.forEach(result => {
        const subject = subjects.find(
            item => Number(item.id) === Number(result.subject_id)
        );

        const obtained = Number(result.marks_obtained);
        const maximum = Number(result.total_marks);
        const passing = Number(result.passing_marks);

        const status = obtained >= passing ? "Pass" : "Fail";

        if (status === "Fail") {
            overallPass = false;
        }

        obtainedTotal += obtained;
        maximumTotal += maximum;

        const row = document.createElement("tr");

        [
            subject?.subject_name || "Unknown",
            maximum,
            passing,
            obtained,
            status
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });

    const percentage = maximumTotal > 0
        ? (obtainedTotal / maximumTotal) * 100
        : 0;

    document.getElementById("reportStudentName").textContent =
        student.student_name;

    document.getElementById("admissionNumber").textContent =
        student.admission_number || "-";

    document.getElementById("reportExamName").textContent =
        exam.exam_name;

    document.getElementById("reportExamDate").textContent =
        exam.exam_date;

    document.getElementById("maximumTotal").textContent =
        maximumTotal;

    document.getElementById("obtainedTotal").textContent =
        obtainedTotal;

    document.getElementById("percentage").textContent =
        percentage.toFixed(2) + "%";

    document.getElementById("overallResult").textContent =
        overallPass ? "PASS" : "FAIL";

    reportCard.hidden = false;
    message.textContent = "Report card generated successfully!";
}

generateButton.addEventListener("click", displayReportCard);

document.getElementById("printReport").addEventListener("click", () => {
    window.print();
});

async function initializeReportCard() {
    const allowed = await checkAdmin();

    if (!allowed) return;

    const studentLoaded = await loadStudents();
    const examLoaded = await loadExams();
    const subjectLoaded = await loadSubjects();

    if (!studentLoaded || !examLoaded || !subjectLoaded) {
        return;
    }

    const { data, error } = await db
        .from("exam_results")
        .select("*");

    if (error) {
        message.textContent = "Results error: " + error.message;
        return;
    }

    results = data || [];
}

initializeReportCard();
