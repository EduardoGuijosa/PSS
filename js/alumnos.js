//  Evita cache del navegador
window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

const API_URL = "http://127.0.0.1:3000/api/alumnos";

(function validarSesion() {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");

  if (!usuario || !rol) {
    window.location.replace("/index.html");
  }
})();

let listaAlumnos, sinAlumnos;

/* =========================
   INICIO
========================= */
window.addEventListener("load", () => {
  listaAlumnos = document.getElementById("listaAlumnos");
  sinAlumnos = document.getElementById("sinAlumnos");

  cargarAlumnos();
});

/* =========================
   HEADERS 
========================= */
function getHeaders() {
  return {
    Authorization: "Bearer " + localStorage.getItem("token"),
  };
}

/* =========================
   CARGAR
========================= */
async function cargarAlumnos() {
  try {
    const res = await fetch(API_URL, {
      headers: getHeaders(),
    });

    if (res.status === 401) return cerrarSesion();

    const alumnos = await res.json();
    mostrarAlumnos(alumnos);
  } catch (error) {
    console.error(error);
  }
}

/* =========================
   MOSTRAR
========================= */
function mostrarAlumnos(alumnos) {
  listaAlumnos.innerHTML = "";

  if (!alumnos.length) {
    sinAlumnos.style.display = "block";
    return;
  }

  sinAlumnos.style.display = "none";

  alumnos.forEach((alumno) => {
    listaAlumnos.innerHTML += `
      <div class="card mb-3 shadow p-3">
        <h3>${alumno.nombre}</h3>
        <p><strong>Matrícula:</strong> ${alumno.matricula}</p>
        <p><strong>Grupo:</strong> ${alumno.grupo || "N/A"}</p>
        <p><strong>Cuatrimestre:</strong> ${alumno.cuatrimestre || "N/A"}</p>
        <p><strong>Email:</strong> ${alumno.email}</p>
        <p><strong>Teléfono:</strong> ${alumno.telefono}</p>
        <p class="text-success">
          <strong>Horas liberadas:</strong> ${alumno.horas_liberadas || 0}
        </p>
        <td style="white-space: pre-line;">
  ${alumno.actividades || "Sin actividades"}
</td>
      </div>
    `;
  });
}
