const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";
const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// HTML ELEMENTS
const timetableForm = document.getElementById("timetableForm");
const classSelect = document.getElementById("classSelect");
const sectionSelect = document.getElementById("sectionSelect");
const subjectSelect = document.getElementById("subjectSelect");
const teacherSelect = document.getElementById("teacherSelect");
const daySelect = document.getElementById("daySelect");
const periodNumber = document.getElementById("periodNumber");
const startTime = document.getElementById("startTime");
const endTime = document.getElementById("endTime");

const timetableTable = document.getElementById("timetableTable");
const statusMessage = document.getElementById("statusMessage");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const formHeading = document.getElementById("formHeading");

const filterClass = document.getElementById("filterClass");
const filterDay = document.getElementById("filterDay");
const filterBtn = document.getElementById("filterBtn");

let classes = [];
let sections = [];
let subjects = [];
let teachers = [];
let editingId = null;

// SHOW MESSAGE
function showMessage(message, success = true) {
    statusMessage.textContent = message;
    statusMessage.style.color = success ? "green" : "red";
}

// ADD OPTIONS TO SELECT
function addOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
}

// LOAD CLASSES
async function loadClasses() {
    const { data, error } = await db
        .from("classes")
        .select("id, class_name")
        .order("id");

    if (error) throw error;

    classes = data || [];

    classSelect.innerHTML = '<option value="">Select Class</option>';
    filterClass.innerHTML = '<option value="">All Classes</option>';

    classes.forEach(item => {
        addOption(classSelect, item.id, item.class_name);
        addOption(filterClass, item.id, item.class_name);
    });
}

// LOAD SECTIONS
async function loadSections(classId) {
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    sectionSelect.disabled = true;

    if (!classId) return;

    const { data, error } = await db
        .from("sections")
        .select("id, class_id, section_name")
        .eq("class_id", classId)
        .order("id");

    if (error) throw error;

    sections = [
        ...sections.filter(s => String(s.class_id) !== String(classId)),
        ...(data || [])
    ];

    (data || []).forEach(item => {
        addOption(sectionSelect, item.id, item.section_name);
    });

    sectionSelect.disabled = false;
}

// LOAD SUBJECTS
async function loadSubjects() {
    const { data, error } = await db
        .from("subjects")
        .select("id, subject_name")
        .order("id");

    if (error) throw error;

    subjects = data || [];

    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    subjects.forEach(item => {
        addOption(subjectSelect, item.id, item.subject_name);
    });
}

// LOAD TEACHERS
async function loadTeachers() {
    const { data, error } = await db
        .from("teachers")
        .select("id, teacher_name")
        .order("id");

    if (error) throw error;

    teachers = data || [];

    teacherSelect.innerHTML = '<option value="">Select Teacher</option>';

    teachers.forEach(item => {
        addOption(teacherSelect, item.id, item.teacher_name);
    });
}

// LOAD ALL TIMETABLES
async function loadTimetables() {
    timetableTable.innerHTML =
        '<tr><td colspan="8">Loading...</td></tr>';

    const { data, error } = await db
        .from("timetables")
        .select("*")
        .order("day_of_week")
        .order("period_number");

    if (error) {
        console.error(error);
        timetableTable.innerHTML =
            '<tr><td colspan="8">Unable to load timetable.</td></tr>';
        showMessage(error.message, false);
        return;
    }

    const sectionIds = [...new Set((data || []).map(x => x.section_id))];

    let sectionData = [];

    if (sectionIds.length) {
        const result = await db
            .from("sections")
            .select("id, class_id, section_name")
            .in("id", sectionIds);

        if (result.error) {
            showMessage(result.error.message, false);
            return;
        }

        sectionData = result.data || [];
    }

    const classIds = [...new Set(sectionData.map(x => x.class_id))];

    let classData = [];

    if (classIds.length) {
        const result = await db
            .from("classes")
            .select("id, class_name")
            .in("id", classIds);

        if (result.error) {
            showMessage(result.error.message, false);
            return;
        }

        classData = result.data || [];
    }

    const subjectIds = [...new Set((data || []).map(x => x.subject_id))];
    const teacherIds = [...new Set((data || []).map(x => x.teacher_id))];

    let subjectData = [];
    let teacherData = [];

    if (subjectIds.length) {
        const result = await db
            .from("subjects")
            .select("id, subject_name")
            .in("id", subjectIds);

        if (result.error) {
            showMessage(result.error.message, false);
            return;
        }

        subjectData = result.data || [];
    }

    if (teacherIds.length) {
        const result = await db
            .from("teachers")
            .select("id, teacher_name")
            .in("id", teacherIds);

        if (result.error) {
            showMessage(result.error.message, false);
            return;
        }

        teacherData = result.data || [];
    }

    const sectionMap = new Map(sectionData.map(x => [String(x.id), x]));
    const classMap = new Map(classData.map(x => [String(x.id), x]));
    const subjectMap = new Map(subjectData.map(x => [String(x.id), x]));
    const teacherMap = new Map(teacherData.map(x => [String(x.id), x]));

    const selectedClass = filterClass.value;
    const selectedDay = filterDay.value;

    const filtered = (data || []).filter(item => {
        const section = sectionMap.get(String(item.section_id));

        if (selectedClass && String(section?.class_id) !== selectedClass) {
            return false;
        }

        if (selectedDay && item.day_of_week !== selectedDay) {
            return false;
        }

        return true;
    });

    timetableTable.innerHTML = "";

    if (!filtered.length) {
        timetableTable.innerHTML =
            '<tr><td colspan="8">No timetable records found.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        const section = sectionMap.get(String(item.section_id));
        const classItem = classMap.get(String(section?.class_id));
        const subject = subjectMap.get(String(item.subject_id));
        const teacher = teacherMap.get(String(item.teacher_id));

        const row = document.createElement("tr");

        const values = [
            classItem?.class_name || "-",
            section?.section_name || "-",
            item.day_of_week,
            item.period_number,
            subject?.subject_name || "-",
            teacher?.teacher_name || "-",
            `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}`
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.className = "action-btn edit-btn";
        editButton.addEventListener("click", () => editTimetable(item));

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "action-btn delete-btn";
        deleteButton.addEventListener("click", () => deleteTimetable(item.id));

        actionCell.append(editButton, deleteButton);
        row.appendChild(actionCell);

        timetableTable.appendChild(row);
    });
}

// CLASS CHANGE
classSelect.addEventListener("change", async () => {
    try {
        await loadSections(classSelect.value);
    } catch (error) {
        showMessage(error.message, false);
    }
});

// SAVE OR UPDATE
timetableForm.addEventListener("submit", async event => {
    event.preventDefault();

    const start = startTime.value;
    const end = endTime.value;

    if (end <= start) {
        showMessage("End time must be after start time.", false);
        return;
    }

    const timetableData = {
        section_id: Number(sectionSelect.value),
        subject_id: Number(subjectSelect.value),
        teacher_id: Number(teacherSelect.value),
        day_of_week: daySelect.value,
        period_number: Number(periodNumber.value),
        start_time: start,
        end_time: end
    };

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    let result;

    if (editingId) {
        result = await db
            .from("timetables")
            .update(timetableData)
            .eq("id", editingId);
    } else {
        result = await db
            .from("timetables")
            .insert([timetableData]);
    }

    saveBtn.disabled = false;
    saveBtn.textContent = editingId ? "Update Timetable" : "Save Timetable";

    if (result.error) {
        console.error(result.error);
        showMessage(result.error.message, false);
        return;
    }

    showMessage(editingId
        ? "Timetable updated successfully!"
        : "Timetable added successfully!");

    resetForm();
    await loadTimetables();
});

// EDIT
async function editTimetable(item) {
    editingId = item.id;

    const section = sections.find(
        x => String(x.id) === String(item.section_id)
    );

    // Load the section if it is not already in the local list.
    let sectionInfo = section;

    if (!sectionInfo) {
        const result = await db
            .from("sections")
            .select("id, class_id, section_name")
            .eq("id", item.section_id)
            .single();

        if (result.error) {
            showMessage(result.error.message, false);
            return;
        }

        sectionInfo = result.data;
        sections.push(sectionInfo);
    }

    classSelect.value = sectionInfo.class_id;
    await loadSections(sectionInfo.class_id);

    sectionSelect.value = item.section_id;
    subjectSelect.value = item.subject_id;
    teacherSelect.value = item.teacher_id;
    daySelect.value = item.day_of_week;
    periodNumber.value = item.period_number;
    startTime.value = item.start_time.slice(0, 5);
    endTime.value = item.end_time.slice(0, 5);

    formHeading.textContent = "Edit Timetable";
    saveBtn.textContent = "Update Timetable";
    cancelBtn.hidden = false;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// DELETE
async function deleteTimetable(id) {
    if (!confirm("Are you sure you want to delete this timetable?")) {
        return;
    }

    const { error } = await db
        .from("timetables")
        .delete()
        .eq("id", id);

    if (error) {
        showMessage(error.message, false);
        return;
    }

    showMessage("Timetable deleted successfully!");
    await loadTimetables();
}

// RESET FORM
function resetForm() {
    timetableForm.reset();

    editingId = null;
    sectionSelect.innerHTML = '<option value="">Select Section</option>';
    sectionSelect.disabled = true;

    formHeading.textContent = "Create Class Timetable";
    saveBtn.textContent = "Save Timetable";
    cancelBtn.hidden = true;
}

// CANCEL EDIT
cancelBtn.addEventListener("click", () => {
    resetForm();
    showMessage("Edit cancelled.");
});

// FILTER
filterBtn.addEventListener("click", loadTimetables);

// INITIAL LOAD
async function initializeTimetable() {
    try {
        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            showMessage("Please login with your Admin account first.", false);
            timetableTable.innerHTML =
                '<tr><td colspan="8">Admin login required.</td></tr>';
            return;
        }

        await loadClasses();
        await loadSubjects();
        await loadTeachers();
        await loadTimetables();

    } catch (error) {
        console.error(error);
        showMessage(error.message, false);
    }
}

initializeTimetable();
