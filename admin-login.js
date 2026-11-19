const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    console.log("Login email:", email);
    const password = document.getElementById("password").value;

    message.textContent = "Logging in...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        message.textContent = error.message;
        message.style.color = "red";
        return;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("full_name, role")
        .eq("id", data.user.id)
        .single();
    console.log("Profile data:", profile);
    console.log("Profile error:", profileError);
    if (profileError || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        message.textContent = "Admin access not available.";
        message.style.color = "red";
        return;
    }

    window.location.href = "dashboard.html";
});
