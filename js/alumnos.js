/* =========================================================
   RECARGA SI LA PÁGINA VIENE DE LA CACHÉ DEL NAVEGADOR
========================================================= */
window.addEventListener("pageshow", function (event) {
  if (event.persisted) window.location.reload();
});

/* =========================================================
   URL DEL ENDPOINT
========================================================= */
const API_URL = "http://127.0.0.1:3000/api/alumnos-grupo";

/* =========================================================
   VALIDAR SESIÓN
========================================================= */
(function validarSesion() {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");

  if (!usuario || !rol) {
    window.location.replace("/index.html");
  }
})();

/* =========================================================
   VARIABLES GLOBALES
========================================================= */
let listaAlumnos;
let sinAlumnos;
let alumnosOriginales = [];
let filtroActual = "todos";
let textoBusquedaAlumno = "";

/* =========================================================
   INICIO
========================================================= */
window.addEventListener("load", () => {
  listaAlumnos = document.getElementById("listaAlumnos");
  sinAlumnos = document.getElementById("sinAlumnos");

  const inputBuscarAlumno = document.getElementById("buscarAlumno");
  const btnLimpiarBusquedaAlumno = document.getElementById(
    "btnLimpiarBusquedaAlumno",
  );

  if (inputBuscarAlumno) {
    inputBuscarAlumno.addEventListener("input", (e) => {
      textoBusquedaAlumno = e.target.value;
      aplicarFiltroAlumno();
    });
  }

  if (btnLimpiarBusquedaAlumno) {
    btnLimpiarBusquedaAlumno.addEventListener("click", () => {
      textoBusquedaAlumno = "";

      if (inputBuscarAlumno) {
        inputBuscarAlumno.value = "";
      }

      aplicarFiltroAlumno();
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const idGrupo = urlParams.get("id");

  if (idGrupo) {
    cargarAlumnos(idGrupo);
  } else {
    window.location.href = "grupos.html";
  }
});

/* =========================================================
   UTILIDAD FOTO
========================================================= */
function obtenerFotoAlumno(foto) {
  return foto && String(foto).trim() !== "" ? foto : "/img/default-user.png";
}

/* =========================================================
   CARGAR ALUMNOS DESDE EL SERVIDOR
========================================================= */
async function cargarAlumnos(idGrupo) {
  try {
    const res = await fetch(`${API_URL}?id=${idGrupo}`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    if (res.status === 401) {
      return window.location.replace("/index.html");
    }

    const alumnos = await res.json();
    alumnosOriginales = Array.isArray(alumnos) ? alumnos : [];

    if (alumnosOriginales.length > 0 && alumnosOriginales[0].grupo) {
      document.getElementById("tituloPagina").innerText =
        `Alumnos del Grupo: ${alumnosOriginales[0].grupo}`;
    }

    actualizarResumen();
    actualizarTarjetasFiltro();
    aplicarFiltroAlumno();
  } catch (error) {
    console.error("Error al cargar alumnos:", error);
    alumnosOriginales = [];
    actualizarResumen();
    actualizarTarjetasFiltro();
    aplicarFiltroAlumno();
  }
}

/* =========================================================
   SABER SI UN ALUMNO YA ESTÁ LIBERADO
========================================================= */
function estaLiberado(alumno) {
  return Number(alumno.horas_liberadas || 0) >= 480;
}

/* =========================================================
   CAMBIAR FILTRO
========================================================= */
function cambiarFiltroAlumno(tipo) {
  filtroActual = tipo;
  actualizarTarjetasFiltro();
  aplicarFiltroAlumno();
}

/* =========================================================
   ACTUALIZAR TARJETA ACTIVA
========================================================= */
function actualizarTarjetasFiltro() {
  const cardTodos = document.getElementById("cardFiltroTodos");
  const cardLiberados = document.getElementById("cardFiltroLiberados");
  const cardPendientes = document.getElementById("cardFiltroPendientes");

  cardTodos?.classList.remove("activo");
  cardLiberados?.classList.remove("activo");
  cardPendientes?.classList.remove("activo");

  if (filtroActual === "todos") {
    cardTodos?.classList.add("activo");
  }

  if (filtroActual === "liberados") {
    cardLiberados?.classList.add("activo");
  }

  if (filtroActual === "pendientes") {
    cardPendientes?.classList.add("activo");
  }
}

/* =========================================================
   ACTUALIZAR TARJETAS RESUMEN
========================================================= */
function actualizarResumen() {
  const total = alumnosOriginales.length;
  const liberados = alumnosOriginales.filter((a) => estaLiberado(a)).length;
  const pendientes = total - liberados;

  const cardTotalAlumnos = document.getElementById("cardTotalAlumnos");
  const cardLiberados = document.getElementById("cardLiberados");
  const cardPendientes = document.getElementById("cardPendientes");

  if (cardTotalAlumnos) cardTotalAlumnos.innerText = total;
  if (cardLiberados) cardLiberados.innerText = liberados;
  if (cardPendientes) cardPendientes.innerText = pendientes;
}

/* =========================================================
   APLICAR FILTRO
========================================================= */
function aplicarFiltroAlumno() {
  let filtrados = [...alumnosOriginales];

  if (filtroActual === "liberados") {
    filtrados = filtrados.filter((alumno) => estaLiberado(alumno));
  }

  if (filtroActual === "pendientes") {
    filtrados = filtrados.filter((alumno) => !estaLiberado(alumno));
  }

  if (textoBusquedaAlumno.trim() !== "") {
    const texto = textoBusquedaAlumno.toLowerCase();

    filtrados = filtrados.filter((alumno) => {
      const nombre = (alumno.nombre || "").toLowerCase();
      const matricula = (alumno.matricula || "").toLowerCase();
      return nombre.includes(texto) || matricula.includes(texto);
    });
  }

  mostrarAlumnos(filtrados);
}

/* =========================================================
   RENDER DE ACTIVIDADES DEL ALUMNO
========================================================= */
function renderActividades(actividades) {
  if (!actividades || actividades.length === 0) {
    return `<span class="text-muted fst-italic">Sin actividades registradas</span>`;
  }

  return actividades
    .map((act) => {
      const esCompleta = act.estatus === "completada";
      const clase = esCompleta
        ? "actividad-mini completa"
        : "actividad-mini proceso";
      const icono = esCompleta
        ? "fas fa-check-circle"
        : "fas fa-hourglass-half";
      const estatusTexto = esCompleta ? "Completada" : "En proceso";

      return `
        <div class="${clase}">
          <i class="${icono} me-1"></i>
          ${act.nombre} — ${act.horas} hrs (${estatusTexto})
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   MOSTRAR ALUMNOS EN TABLA
========================================================= */
function mostrarAlumnos(alumnos) {
  listaAlumnos.innerHTML = "";

  if (!alumnos || alumnos.length === 0) {
    sinAlumnos.style.display = "block";
    return;
  }

  sinAlumnos.style.display = "none";

  alumnos.forEach((alumno) => {
    const horas = Number(alumno.horas_liberadas || 0);
    const porcentaje = Math.min(100, Math.round((horas / 480) * 100));
    const liberado = estaLiberado(alumno);

    listaAlumnos.innerHTML += `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <img
              src="${obtenerFotoAlumno(alumno.foto_perfil)}"
              alt="Foto de ${alumno.nombre}"
              style="width:52px; height:52px; object-fit:cover; border-radius:50%; border:2px solid #d9d9d9;"
            />
            <div>
              <div class="fw-bold text-primary nombre-tabla">${alumno.nombre}</div>
              <div class="text-muted small">${alumno.matricula}</div>
            </div>
          </div>
        </td>

        <td>
          <div><i class="fas fa-envelope me-2 text-primary"></i>${alumno.email || "Sin correo"}</div>
          <div><i class="fas fa-phone me-2 text-primary"></i>${alumno.telefono || "Sin teléfono"}</div>
        </td>

        <td style="min-width: 220px;">
          <div class="d-flex justify-content-between small mb-1">
            <span class="fw-semibold">${horas} / 480 hrs</span>
            <span class="${liberado ? "text-success" : "text-warning"} fw-bold">
              ${porcentaje}%
            </span>
          </div>
          <div class="progress" style="height: 10px;">
            <div
              class="progress-bar ${liberado ? "bg-success" : "bg-warning"}"
              role="progressbar"
              style="width: ${porcentaje}%"
              aria-valuenow="${porcentaje}"
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </td>

        <td>
          <span class="badge estado-badge ${liberado ? "estado-liberado" : "estado-pendiente"}">
            ${liberado ? "Liberado" : "Pendiente"}
          </span>
        </td>

        <td style="min-width: 280px;">
          ${renderActividades(alumno.actividades)}
        </td>
      </tr>
    `;
  });
}

/* =========================================================
   FUNCIÓN GLOBAL
========================================================= */
window.cambiarFiltroAlumno = cambiarFiltroAlumno;
