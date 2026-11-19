
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";




const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// HTML Elements
const studentForm = document.getElementById("studentForm");
const studentTableBody = document.getElementById("studentTableBody");
const formMessage = document.getElementById("formMessage");
const saveStudentBtn = document.getElementById("saveStudentBtn");

const classSelect = document.getElementById("classId");
const sectionSelect = document.getElementById("sectionId");

const filterClassSelect = document.getElementById("filterClassId");
const filterSectionSelect = document.getElementById("filterSectionId");

const studentPhotoInput = document.getElementById("studentPhoto");
const studentPhotoPreview = document.getElementById("studentPhotoPreview");
const studentPhotoPreviewContainer = document.getElementById(
    "studentPhotoPreviewContainer"
);

let classesCache = [];
let studentRecords = [];

const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

// Check Admin Login
async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.href = "index.html";
        return false;
    }

    const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", sessionData.session.user.id)
        .single();

    if (error || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Escape HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Student Photo Preview
studentPhotoInput.addEventListener("change", function () {
    const file = this.files[0];

    studentPhotoPreview.removeAttribute("src");
    studentPhotoPreviewContainer.hidden = true;

    if (!file) return;

    if (!allowedPhotoTypes.includes(file.type)) {
        alert("Only JPG, PNG and WEBP photos are allowed.");
        this.value = "";
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Photo size must be 2 MB or less.");
        this.value = "";
        return;
    }

    studentPhotoPreview.src = URL.createObjectURL(file);
    studentPhotoPreviewContainer.hidden = false;
});

// Upload Student Photo
async function uploadStudentPhoto(file, admissionNumber) {
    if (!file || !allowedPhotoTypes.includes(file.type)) {
        throw new Error("Please select a valid student photo.");
    }

    if (file.size > 2 * 1024 * 1024) {
        throw new Error("Photo size must be 2 MB or less.");
    }

    const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    const safeAdmissionNumber = admissionNumber
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    const filePath =
        `students/${safeAdmissionNumber}/${crypto.randomUUID()}.${extension[file.type]}`;

    const { error } = await supabaseClient.storage
        .from("profile-photos")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) {
        throw new Error("Photo upload failed: " + error.message);
    }

    return filePath;
}

// Get Private Photo URL
async function getStudentPhotoURL(photoPath) {
    if (!photoPath) return null;

    const { data, error } = await supabaseClient.storage
        .from("profile-photos")
        .createSignedUrl(photoPath, 3600);

    if (error) {
        console.error("Photo URL error:", error.message);
        return null;
    }

    return data?.signedUrl || null;
}

// Load Classes
async function loadClasses() {
    classSelect.innerHTML = '<option value="">Loading classes...</option>';
    classSelect.disabled = true;

    const { data, error } = await supabaseClient
        .from("classes")
        .select("id, class_name")
        .order("id", { ascending: true });

    if (error) {
        console.error("Class loading error:", error.message);
        classSelect.innerHTML =
            '<option value="">Unable to load classes</option>';
        return;
    }

    classesCache = data || [];

    classSelect.innerHTML = '<option value="">Select Class</option>';
    filterClassSelect.innerHTML =
        '<option value="all">All Classes</option>';

    classesCache.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.class_name;
        classSelect.appendChild(option);

        const filterOption = document.createElement("option");
        filterOption.value = item.id;
        filterOption.textContent = item.class_name;
        filterClassSelect.appendChild(filterOption);
    });

    classSelect.disabled = classesCache.length === 0;
}

// Load Sections for Student Form
async function loadSections(classId) {
    sectionSelect.innerHTML =
        '<option value="">Loading sections...</option>';
    sectionSelect.disabled = true;

    if (!classId) {
        sectionSelect.innerHTML =
            '<option value="">Select Class first</option>';
        return;
    }

    const { data, error } = await supabaseClient
        .from("sections")
        .select("id, section_name")
        .eq("class_id", Number(classId))
        .order("section_name");

    if (error) {
        console.error("Section loading error:", error.message);
        sectionSelect.innerHTML =
            '<option value="">Unable to load sections</option>';
        return;
    }

    sectionSelect.innerHTML =
        '<option value="">Select Section</option>';

    if (!data || data.length === 0) {
        sectionSelect.innerHTML =
            '<option value="">No sections available</option>';
        return;
    }

    data.forEach(section => {
        const option = document.createElement("option");
        option.value = section.id;
        option.textContent = section.section_name;
        sectionSelect.appendChild(option);
    });

    sectionSelect.disabled = false;
}

// Load Sections for Filter
async function loadFilterSections(classId) {
    filterSectionSelect.innerHTML =
        '<option value="all">All Sections</option>';

    if (!classId || classId === "all") {
        filterSectionSelect.disabled = true;
        renderStudents();
        return;
    }

    filterSectionSelect.disabled = true;
    filterSectionSelect.innerHTML =
        '<option value="all">Loading sections...</option>';

    const { data, error } = await supabaseClient
        .from("sections")
        .select("id, section_name")
        .eq("class_id", Number(classId))
        .order("section_name");

    if (error) {
        console.error("Filter section error:", error.message);
        filterSectionSelect.innerHTML =
            '<option value="all">Unable to load sections</option>';
        renderStudents();
        return;
    }

    filterSectionSelect.innerHTML =
        '<option value="all">All Sections</option>';

    (data || []).forEach(section => {
        const option = document.createElement("option");
        option.value = section.id;
        option.textContent = section.section_name;
        filterSectionSelect.appendChild(option);
    });

    filterSectionSelect.disabled = false;
    renderStudents();
}

// Form Class Change
classSelect.addEventListener("change", async function () {
    await loadSections(this.value);
});

// Filter Class Change
filterClassSelect.addEventListener("change", async function () {
    filterSectionSelect.value = "all";
    await loadFilterSections(this.value);
});

// Filter Section Change
filterSectionSelect.addEventListener("change", renderStudents);

// Show Student Credentials
function showStudentCredentials(studentId, password) {
    let panel = document.getElementById("studentCredentialsPanel");

    if (!panel) {
        panel = document.createElement("div");
        panel.id = "studentCredentialsPanel";

        panel.style.cssText = `
            margin: 20px 0;
            padding: 18px;
            border: 1px solid #198754;
            border-radius: 10px;
            background: #f0fff5;
            color: #222;
        `;

        formMessage.insertAdjacentElement("afterend", panel);
    }

    const credentials =
        `AIMS Student Login\nStudent ID: ${studentId}\nTemporary Password: ${password}`;

    panel.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Student Account Created Successfully";

    const idText = document.createElement("p");
    idText.textContent = `Student ID: ${studentId}`;

    const passwordText = document.createElement("p");
    passwordText.textContent = `Temporary Password: ${password}`;

    const note = document.createElement("p");
    note.textContent =
        "Save these credentials now. The temporary password will not be shown again.";
    note.style.color = "#a15c00";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy Credentials";

    copyButton.onclick = async () => {
        try {
            await navigator.clipboard.writeText(credentials);
            copyButton.textContent = "Copied!";
        } catch {
            alert("Copy failed. Please copy manually.");
        }
    };

    const shareButton = document.createElement("button");
    shareButton.type = "button";
    shareButton.textContent = "Share on WhatsApp";
    shareButton.style.marginLeft = "8px";

    shareButton.onclick = () => {
        const url =
            "https://wa.me/?text=" + encodeURIComponent(credentials);
        window.open(url, "_blank", "noopener,noreferrer");
    };

    panel.append(
        heading,
        idText,
        passwordText,
        note,
        copyButton,
        shareButton
    );
}

// Load Students
async function loadStudents() {
    studentTableBody.innerHTML =
        '<tr><td colspan="10">Loading students...</td></tr>';

    const { data, error } = await supabaseClient
        .from("students")
        .select(`
            *,
            enrollments (
                id,
                section_id,
                sections (
                    id,
                    section_name,
                    class_id,
                    classes (
                        class_name
                    )
                )
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Student loading error:", error.message);
        studentTableBody.innerHTML =
            `<tr><td colspan="10">Unable to load students: ${escapeHTML(error.message)}</td></tr>`;
        return;
    }

    studentRecords = data || [];
    renderStudents();
}

// Get enrollment's section
function getEnrollmentSection(enrollment) {
    if (!enrollment || !enrollment.sections) return null;

    return Array.isArray(enrollment.sections)
        ? enrollment.sections[0] || null
        : enrollment.sections;
}

// Render Students
function renderStudents() {
    const selectedClass = filterClassSelect.value;
    const selectedSection = filterSectionSelect.value;

    let filteredStudents = [...studentRecords];

    if (selectedClass && selectedClass !== "all") {
        filteredStudents = filteredStudents.filter(student =>
            (student.enrollments || []).some(enrollment => {
                const section = getEnrollmentSection(enrollment);
                return section &&
                    String(section.class_id) === String(selectedClass);
            })
        );
    }

    if (selectedSection && selectedSection !== "all") {
        filteredStudents = filteredStudents.filter(student =>
            (student.enrollments || []).some(enrollment =>
                String(enrollment.section_id) === String(selectedSection)
            )
        );
    }

    studentTableBody.innerHTML = "";

    if (filteredStudents.length === 0) {
        studentTableBody.innerHTML =
            '<tr><td colspan="10">No students found.</td></tr>';
        return;
    }

    filteredStudents.forEach(student => {
        const row = document.createElement("tr");

        const enrollment = student.enrollments?.[0];
        const section = getEnrollmentSection(enrollment);

        const className =
            section?.classes?.class_name || "-";

        const sectionName =
            section?.section_name || "-";

        row.innerHTML = `
            <td>${escapeHTML(student.id)}</td>
            <td class="student-photo-cell">-</td>
            <td>${escapeHTML(student.student_name)}</td>
            <td>${escapeHTML(student.admission_number)}</td>
            <td>${escapeHTML(student.date_of_birth || "-")}</td>
            <td>${escapeHTML(student.gender || "-")}</td>
            <td>${escapeHTML(student.admission_date || "-")}</td>
            <td>${escapeHTML(className)}</td>
            <td>${escapeHTML(sectionName)}</td>
            <td>
                <button type="button" class="edit-btn">Edit</button>
                <button type="button" class="status-btn">
                    ${student.is_active === false ? "Activate" : "Deactivate"}
                </button>
                <button type="button" class="delete-btn">Delete</button>
            </td>
        `;

        row.querySelector(".edit-btn").addEventListener("click", () => {
            editStudent(student);
        });

        row.querySelector(".status-btn").addEventListener("click", () => {
            toggleStudentStatus(student);
        });

        row.querySelector(".delete-btn").addEventListener("click", event => {
            deleteStudent(student, event.currentTarget);
        });

        studentTableBody.appendChild(row);

        if (student.photo_url) {
            const photoCell = row.querySelector(".student-photo-cell");

            getStudentPhotoURL(student.photo_url).then(photoURL => {
                if (!photoURL || !document.body.contains(photoCell)) return;

                const image = document.createElement("img");
                image.src = photoURL;
                image.alt = "Student photo";
                image.width = 45;
                image.height = 45;
                image.style.objectFit = "cover";
                image.style.borderRadius = "50%";

                photoCell.replaceChildren(image);
            });
        }
    });
}

// Create Student
studentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    const studentName =
        document.getElementById("studentName").value.trim();

    const admissionNumber =
        document.getElementById("admissionNumber").value.trim();

    const dateOfBirth =
        document.getElementById("dateOfBirth").value || null;

    const gender =
        document.getElementById("gender").value || null;

    const admissionDate =
        document.getElementById("admissionDate").value || null;

    const selectedClassId = classSelect.value;
    const selectedSectionId = sectionSelect.value;
    const photoFile = studentPhotoInput.files[0];

    if (!studentName || !admissionNumber) {
        formMessage.textContent =
            "Student Name and Student ID are required.";
        formMessage.style.color = "red";
        return;
    }

    if (!selectedClassId || !selectedSectionId) {
        formMessage.textContent =
            "Please select both Class and Section.";
        formMessage.style.color = "red";
        return;
    }

    if (!photoFile) {
        formMessage.textContent =
            "Please select a student profile photo.";
        formMessage.style.color = "red";
        return;
    }

    if (!allowedPhotoTypes.includes(photoFile.type)) {
        formMessage.textContent =
            "Only JPG, PNG and WEBP photos are allowed.";
        formMessage.style.color = "red";
        return;
    }

    if (photoFile.size > 2 * 1024 * 1024) {
        formMessage.textContent =
            "Photo size must be 2 MB or less.";
        formMessage.style.color = "red";
        return;
    }

    saveStudentBtn.disabled = true;
    saveStudentBtn.textContent = "Uploading Photo...";

    formMessage.textContent =
        "Uploading photo and creating Student account...";
    formMessage.style.color = "#176b87";

    const oldPanel =
        document.getElementById("studentCredentialsPanel");

    if (oldPanel) oldPanel.remove();

    let uploadedPhotoPath = null;

    try {
        uploadedPhotoPath = await uploadStudentPhoto(
            photoFile,
            admissionNumber
        );

        saveStudentBtn.textContent = "Creating Account...";

        const { data, error } =
            await supabaseClient.functions.invoke(
                "create-student",
                {
                    body: {
                        student_name: studentName,
                        admission_number: admissionNumber,
                        date_of_birth: dateOfBirth,
                        gender: gender,
                        admission_date: admissionDate,
                        class_id: Number(selectedClassId),
                        section_id: Number(selectedSectionId)
                    }
                }
            );

        if (error) {
            let errorMessage = error.message;

            try {
                const response = await error.context.json();
                if (response?.error) errorMessage = response.error;
            } catch {
                // Keep original error.
            }

            throw new Error(errorMessage);
        }

        if (!data || !data.success) {
            throw new Error(
                data?.error || "Student account creation failed."
            );
        }

        const { error: photoSaveError } = await supabaseClient
            .from("students")
            .update({ photo_url: uploadedPhotoPath })
            .eq("admission_number", admissionNumber);

        studentForm.reset();

        sectionSelect.innerHTML =
            '<option value="">Select Class first</option>';
        sectionSelect.disabled = true;

        studentPhotoPreview.removeAttribute("src");
        studentPhotoPreviewContainer.hidden = true;

        if (photoSaveError) {
            console.error("Photo save error:", photoSaveError.message);
            formMessage.textContent =
                "Student created, but photo reference could not be saved.";
            formMessage.style.color = "#b45309";
        } else {
            formMessage.textContent =
                "Student created, Class assigned and photo saved successfully!";
            formMessage.style.color = "green";
        }

        await loadStudents();

        showStudentCredentials(
            data.student_id,
            data.temporary_password
        );

    } catch (error) {
        console.error("Student creation error:", error);

        if (uploadedPhotoPath) {
            const { error: cleanupError } = await supabaseClient.storage
                .from("profile-photos")
                .remove([uploadedPhotoPath]);

            if (cleanupError) {
                console.error("Photo cleanup error:", cleanupError.message);
            }
        }

        formMessage.textContent = "Error: " + error.message;
        formMessage.style.color = "red";

    } finally {
        saveStudentBtn.disabled = false;
        saveStudentBtn.textContent = "Save Student";
    }
});

// Edit Student
async function editStudent(student) {
    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    const newName = prompt(
        "Enter Student Name:",
        student.student_name
    );

    if (newName === null) return;

    const newAdmissionNumber = prompt(
        "Enter Admission Number:",
        student.admission_number
    );

    if (newAdmissionNumber === null) return;

    if (!newName.trim() || !newAdmissionNumber.trim()) {
        alert("Name and Admission Number cannot be empty.");
        return;
    }

    const { error } = await supabaseClient
        .from("students")
        .update({
            student_name: newName.trim(),
            admission_number: newAdmissionNumber.trim()
        })
        .eq("id", student.id);

    if (error) {
        alert("Update failed: " + error.message);
        return;
    }

    alert("Student updated successfully!");
    await loadStudents();
}

// Activate / Deactivate Student
async function toggleStudentStatus(student) {
    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    const nextStatus = !student.is_active;
    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = confirm(
        `Are you sure you want to ${action} ${student.student_name}?`
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("students")
        .update({ is_active: nextStatus })
        .eq("id", student.id);

    if (error) {
        alert("Status update failed: " + error.message);
        return;
    }

    alert(
        `Student ${nextStatus ? "activated" : "deactivated"} successfully.`
    );

    await loadStudents();
}

// Secure Permanent Deletion through General Admin Edge Function
async function deleteStudent(student, deleteButton) {
    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    const admissionNumber = student.admission_number;

    const confirmed = confirm(
        "PERMANENT STUDENT DELETION\n\n" +
        "Student Name: " + student.student_name + "\n" +
        "Admission Number: " + admissionNumber + "\n\n" +
        "This action will permanently delete:\n" +
        "- Student database record\n" +
        "- Linked Student profile\n" +
        "- Linked Student Auth login\n" +
        "- Related attendance, enrollment, marks and submissions\n" +
        "- The Student's profile photo, if present\n\n" +
        "Parent accounts will NOT be deleted.\n" +
        "Fee invoices and payment history will NOT be deleted.\n" +
        "Students with fee invoices cannot be deleted.\n\n" +
        "This action cannot be undone.\n\n" +
        "Do you want to continue?"
    );

    if (!confirmed) return;

    const secondConfirmation = prompt(
        "To confirm permanent deletion, type exactly:\n" +
        "DELETE " + admissionNumber
    );

    if (secondConfirmation !== "DELETE " + admissionNumber) {
        alert("Confirmation did not match. No deletion was performed.");
        return;
    }

    try {
        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";

        const { data, error } =
            await supabaseClient.functions.invoke(
                "admin-delete-school-account",
                {
                    body: {
                        account_type: "student",
                        account_identifier: admissionNumber,
                        confirm: true,
                        delete_timetable: false
                    }
                }
            );

        if (error) {
            let errorMessage = error.message;

            try {
                const response = await error.context.json();

                if (response?.error) {
                    errorMessage = response.error;
                }
            } catch {
                // Keep original error.
            }

            throw new Error(errorMessage);
        }

        if (
            !data ||
            data.success !== true ||
            data.database_deleted !== true
        ) {
            throw new Error(
                data?.error || "The server did not confirm deletion."
            );
        }

        if (data.cleanup_required) {
            alert(
                "Database deletion completed, but some cleanup needs attention.\n\n" +
                "Auth cleanup: " + data.auth_cleanup_status + "\n" +
                "Photo cleanup: " + data.storage_cleanup_status + "\n\n" +
                "Do NOT retry deletion. Check the audit log and Edge Function logs."
            );

            await loadStudents();
            return;
        }

        alert(
            "Student permanently deleted successfully!\n\n" +
            "Admission Number: " + admissionNumber + "\n" +
            "Database: Deleted\n" +
            "Auth cleanup: " + data.auth_cleanup_status + "\n" +
            "Photo cleanup: " + data.storage_cleanup_status + "\n" +
            "Audit Log ID: " + data.audit_log_id
        );

        await loadStudents();

    } catch (error) {
        console.error("Permanent deletion error:", error);

        alert(
            "Deletion could not be confirmed.\n\n" +
            error.message +
            "\n\nIf the request may have reached the server, check the audit log before retrying."
        );

    } finally {
        if (deleteButton && document.body.contains(deleteButton)) {
            deleteButton.disabled = false;
            deleteButton.textContent = "Delete";
        }
    }
}

// Start Page
async function startPage() {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

    await loadClasses();
    await loadStudents();
}

startPage();
