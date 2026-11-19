
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function loadDashboard() {

    // Check login session
    const { data: sessionData, error: sessionError } =
        await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.href = "index.html";
        return;
    }

    // Verify admin role
    const user = sessionData.session.user;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("full_name, role")
            .eq("id", user.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return;
    }

    // Show administrator name
    document.querySelector(".admin-info span").textContent =
        profile.full_name;

    // Count students
    const { count: students, error: studentError } =
        await supabaseClient
            .from("students")
            .select("*", { count: "exact", head: true });

    // Count teachers
    const { count: teachers, error: teacherError } =
        await supabaseClient
            .from("teachers")
            .select("*", { count: "exact", head: true });

    // Count classes
    const { count: classes, error: classError } =
        await supabaseClient
            .from("classes")
            .select("*", { count: "exact", head: true });

    // Calculate pending fees
    const { data: invoices, error: feeError } = await supabaseClient
    .from("fee_invoices")
    .select("total_amount, status");

    if (studentError || teacherError || classError || feeError) {
        console.error("Dashboard data error:", {
            studentError,
            teacherError,
            classError,
            feeError
        });

        alert("Dashboard data load nahi ho paya. Console check karo.");
        return;
    }

    const pendingAmount = invoices.reduce((total, invoice) => {
    if (invoice.status === "pending" || invoice.status === "partial") {
        return total + Number(invoice.total_amount || 0);
    }
    return total;
}, 0);
    

    document.getElementById("studentCount").textContent =
        students ?? 0;

    document.getElementById("teacherCount").textContent =
        teachers ?? 0;

    document.getElementById("classCount").textContent =
        classes ?? 0;

    document.getElementById("pendingFees").textContent =
        "₹" + pendingAmount.toLocaleString("en-IN");

}

// Logout
document.getElementById("logoutBtn").addEventListener("click", async function () {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("Logout nahi ho paya: " + error.message);
        return;
    }

    window.location.href = "index.html";

});

// Start dashboard
loadDashboard();




const menuToggle = document.getElementById("menuToggle");
const closeMenu = document.getElementById("closeMenu");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openMobileMenu() {
    sidebar.classList.add("mobile-open");
    sidebarOverlay.classList.add("show");
}

function closeMobileMenu() {
    sidebar.classList.remove("mobile-open");
    sidebarOverlay.classList.remove("show");
}

menuToggle.addEventListener("click", openMobileMenu);
closeMenu.addEventListener("click", closeMobileMenu);
sidebarOverlay.addEventListener("click", closeMobileMenu);
