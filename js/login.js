const API_URL = "http://127.0.0.1:3000/api/login";
const form = document.getElementById("loginForm");

/* =========================
   LOGIN
========================= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error");
      return;
    }

    // GUARDAR TOKEN
    localStorage.setItem("usuario", data.usuario);
    localStorage.setItem("rol", data.rol);
    localStorage.setItem("token", data.token);

    alert("Bienvenido " + data.usuario);

    window.location.href = "/html/portada.html";
  } catch (err) {
    console.error(err);
    alert("Error de conexión");
  }
});
