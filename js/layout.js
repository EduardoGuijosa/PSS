/* =========================
   VALIDAR SESIÓN 
========================= */
function validarSesion() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/index.html";
  }
}

/* =========================
   CARGAR MENU Y TOPBAR
========================= */
function cargarLayout() {
  validarSesion();

  fetch("/html/menu.html")
    .then((res) => res.text())
    .then((data) => {
      document.getElementById("menu-container").innerHTML = data;

      const rol = localStorage.getItem("rol")?.toLowerCase();

      if (rol === "director" || rol === "alumno") {
        const btnAlumnos = document.getElementById("btnAlumnos");
        if (btnAlumnos) btnAlumnos.style.display = "none";
      }

      if (rol !== "alumno") {
        const btnProgreso = document.getElementById("btnProgreso");
        if (btnProgreso) btnProgreso.style.display = "none";
      }

      const btnPortada = document.getElementById("btnPortada");
      const btnProgreso = document.getElementById("btnProgreso");
      const btnProyectos = document.getElementById("btnProyectos");
      const btnAlumnos = document.getElementById("btnAlumnos");
      const btnSalir = document.getElementById("btnSalir");

      if (btnPortada) btnPortada.addEventListener("click", irPortada);
      if (btnProgreso) btnProgreso.addEventListener("click", irProgreso);
      if (btnProyectos) btnProyectos.addEventListener("click", irProyectos);
      if (btnAlumnos) btnAlumnos.addEventListener("click", irAlumnos);
      if (btnSalir) btnSalir.addEventListener("click", cerrarSesion);

      // 🔥 AQUÍ ADENTRO (DESPUÉS DE CARGAR EL DOM)
      if (window.cargarProgreso) {
        window.cargarProgreso();
      }
    });

  fetch("/html/topbar.html")
    .then((res) => res.text())
    .then((data) => {
      document.getElementById("topbar-container").innerHTML = data;
      cargarUsuario();
    });
}

/* =========================
   USUARIO
========================= */
function cargarUsuario() {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");

  //  SI NO HAY SESIÓN → BLOQUEA
  if (!usuario || !rol) {
    localStorage.clear();
    window.location.replace("/index.html"); //  replace evita regresar con flecha
    return;
  }

  document.getElementById("bienvenida").innerText = "Bienvenido " + usuario;
  document.getElementById("rol").innerText = rol;
}

/* =========================
   MENU
========================= */
function irPortada() {
  window.location.href = "/html/portada.html";
}

function irProgreso() {
  window.location.href = "/html/progreso.html";
}

function irProyectos() {
  window.location.href = "/html/actividad.html";
}

function irAlumnos() {
  window.location.href = "/html/alumnos.html";
}

function cerrarSesion() {
  localStorage.clear();
  window.location.href = "/index.html";
}

/* =========================
   INICIO
========================= */
window.addEventListener("load", cargarLayout);
