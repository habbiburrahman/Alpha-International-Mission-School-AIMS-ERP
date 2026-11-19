
// ==========================================
// AIMS ERP - FEE STRUCTURE MANAGEMENT
// ==========================================

// Use your existing Supabase URL and publishable key.
// Do not use the service_role key in frontend code.
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// HTML Elements
const classSelect = document.getElementById("classSelect");
const academicYearSelect = document.getElementById("academicYearSelect");
const feeCategorySelect = document.getElementById("feeCategorySelect");
const feeStructureForm = document.getElementById("feeStructureForm");
const amountInput = document.getElementById("amount");
const message = document.getElementById("message");
const structureTableBody = document.getElementById("structureTableBody");
const saveBtn = document.getElementById("saveBtn");

// Data Storage
let classesData = [];
let yearsData = [];
let categoriesData = [];

// ==========================================
// MESSAGE
// ==========================================

function showMessage(text, color = "black") {
    message.textContent = text;
    message.style.color = color;
}

// ==========================================
// CHECK ADMIN
// ==========================================

async function checkAdmin() {
    const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        showMessage("Please login as Admin first.", "red");
        return false;
    }

    const { data, error } = await supabaseClient.rpc("is_admin");

    if (error || data !== true) {
        showMessage("Access denied. Admin only.", "red");
        return false;
    }

    return true;
}

// ==========================================
// LOAD CLASSES
// ==========================================

async function loadClasses() {
    const { data, error } = await supabaseClient
        .from("classes")
        .select("id, class_name")
        .order("id");

    if (error) {
        showMessage("Classes Error: " + error.message, "red");
        return false;
    }

    classesData = data || [];

    classSelect.innerHTML =
        '<option value="">Select Class</option>';

    classesData.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.class_name;
        classSelect.appendChild(option);
    });

    return true;
}

// ==========================================
// LOAD ACADEMIC YEARS
// ==========================================

async function loadAcademicYears() {
    const { data, error } = await supabaseClient
        .from("academic_years")
        .select("id, year_name, is_active")
        .order("id", { ascending: false });

    if (error) {
        showMessage("Academic Year Error: " + error.message, "red");
        return false;
    }

    yearsData = data || [];

    academicYearSelect.innerHTML =
        '<option value="">Select Academic Year</option>';

    yearsData.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;

        option.textContent = item.year_name;

        if (item.is_active) {
            option.textContent += " (Active)";
        }

        academicYearSelect.appendChild(option);
    });

    return true;
}

// ==========================================
// LOAD FEE CATEGORIES
// ==========================================

async function loadCategories() {
    const { data, error } = await supabaseClient
        .from("fee_categories")
        .select("id, category_name")
        .order("id");

    if (error) {
        showMessage("Category Error: " + error.message, "red");
        return false;
    }

    categoriesData = data || [];

    feeCategorySelect.innerHTML =
        '<option value="">Select Fee Category</option>';

    categoriesData.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.category_name;
        feeCategorySelect.appendChild(option);
    });

    return true;
}

// ==========================================
// LOAD EXISTING FEE STRUCTURES
// ==========================================

async function loadFeeStructures() {
    structureTableBody.innerHTML =
        '<tr><td colspan="5">Loading fee structures...</td></tr>';

    const { data, error } = await supabaseClient
        .from("fee_structures")
        .select("id, class_id, academic_year_id, category_id, amount")
        .order("id", { ascending: false });

    if (error) {
        structureTableBody.innerHTML =
            '<tr><td colspan="5">Unable to load fee structures.</td></tr>';

        showMessage("Fee Structures Error: " + error.message, "red");
        return false;
    }

    structureTableBody.innerHTML = "";

    if (!data || data.length === 0) {
        structureTableBody.innerHTML =
            '<tr><td colspan="5">No fee structures found.</td></tr>';

        return true;
    }

    data.forEach(item => {
        const classItem = classesData.find(
            c => Number(c.id) === Number(item.class_id)
        );

        const yearItem = yearsData.find(
            y => Number(y.id) === Number(item.academic_year_id)
        );

        const categoryItem = categoriesData.find(
            c => Number(c.id) === Number(item.category_id)
        );

        const row = document.createElement("tr");

        const values = [
            item.id,
            classItem ? classItem.class_name : "Unknown",
            yearItem ? yearItem.year_name : "Unknown",
            categoryItem ? categoryItem.category_name : "Unknown",
            "₹" + Number(item.amount).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        structureTableBody.appendChild(row);
    });

    return true;
}

// ==========================================
// SAVE OR UPDATE FEE STRUCTURE
// ==========================================

async function saveFeeStructure(event) {
    event.preventDefault();

    const allowed = await checkAdmin();

    if (!allowed) return;

    const classId = Number(classSelect.value);
    const yearId = Number(academicYearSelect.value);
    const categoryId = Number(feeCategorySelect.value);
    const amount = Number(amountInput.value);

    if (
        !classId ||
        !yearId ||
        !categoryId ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        showMessage("Please fill all fields correctly.", "red");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    showMessage("Checking existing fee structure...", "blue");

    try {
        // Check whether this class/year/category already exists.
        const { data: existing, error: checkError } =
            await supabaseClient
                .from("fee_structures")
                .select("id")
                .eq("class_id", classId)
                .eq("academic_year_id", yearId)
                .eq("category_id", categoryId)
                .order("id", { ascending: true })
                .limit(1);

        if (checkError) {
            throw new Error(checkError.message);
        }

        let saveError = null;
        let successMessage = "";

        if (existing && existing.length > 0) {

            // Update existing structure
            const { error } = await supabaseClient
                .from("fee_structures")
                .update({
                    amount: amount
                })
                .eq("id", existing[0].id);

            saveError = error;
            successMessage = "Fee structure updated successfully!";

        } else {

            // Insert new structure
            const { error } = await supabaseClient
                .from("fee_structures")
                .insert({
                    class_id: classId,
                    academic_year_id: yearId,
                    category_id: categoryId,
                    amount: amount
                });

            saveError = error;
            successMessage = "New fee structure saved successfully!";
        }

        if (saveError) {
            throw new Error(saveError.message);
        }

        showMessage(successMessage, "green");

        feeStructureForm.reset();

        await loadFeeStructures();

    } catch (error) {
        showMessage("Save Error: " + error.message, "red");

    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Fee Structure";
    }
}

// ==========================================
// FORM EVENT
// ==========================================

feeStructureForm.addEventListener(
    "submit",
    saveFeeStructure
);

// ==========================================
// INITIALIZE PAGE
// ==========================================

async function initializePage() {
    showMessage("Loading fee structure data...", "blue");

    const allowed = await checkAdmin();

    if (!allowed) return;

    const results = await Promise.all([
        loadClasses(),
        loadAcademicYears(),
        loadCategories()
    ]);

    if (results.some(result => result === false)) {
        return;
    }

    await loadFeeStructures();

    showMessage(
        "Fee Structure Management is ready.",
        "green"
    );
}

initializePage();
