/* =========================================================
   CONFIGURACIÓN GENERAL
========================================================= */

// Esta función arma los headers para las peticiones protegidas.
// Así evitamos repetir el token en cada fetch.
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

/* =========================================================
   UTILIDADES
========================================================= */

// Escapa texto para evitar problemas al insertarlo en innerHTML
function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Convierte una fecha tipo 2026-05-12 o 2026-05-12T00:00:00.000Z
// al formato visual dd/mm/yyyy
function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  const soloFecha = String(fecha).split("T")[0];
  const partes = soloFecha.split("-");

  if (partes.length !== 3) return soloFecha;

  const [anio, mes, dia] = partes;
  return `${dia}/${mes}/${anio}`;
}

/* =========================================================
   VARIABLES GLOBALES
========================================================= */

// Guarda el filtro actual de la vista
let filtroProgreso = "Todos";

// Guarda todas las actividades que llegan del backend
let actividadesOriginalesProgreso = [];

// Guarda el resumen general de horas
let resumenProgreso = {
  horasLiberadas: 0,
  horasFaltantes: 480,
};

// Guarda el nombre de la actividad actual para mostrarlo en el modal
let nombreActividadActualModal = "";

/* =========================================================
   INICIO
========================================================= */

// Cuando carga la página se consulta el progreso del alumno
document.addEventListener("DOMContentLoaded", () => {
  cargarProgreso();
  actualizarBotonesFiltroProgreso();
});

/* =========================================================
   LIMPIEZA GLOBAL DE MODALES
   - Evita que el fondo oscuro se quede pegado
========================================================= */

document.addEventListener("hidden.bs.modal", function () {
  document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
  document.body.classList.remove("modal-open");
  document.body.style.paddingRight = "0";
  document.body.style.overflow = "auto";
});

/* =========================================================
   CARGAR PROGRESO DEL ALUMNO
========================================================= */

// Consulta el backend y obtiene:
// - horas liberadas
// - horas faltantes
// - actividades inscritas
async function cargarProgreso() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/progreso", {
      headers: getHeaders(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error al cargar progreso:", data.msg);
      return;
    }

    const horasEl = document.getElementById("horasLiberadas");
    const faltantesEl = document.getElementById("horasFaltantes");

    if (!horasEl || !faltantesEl) return;

    resumenProgreso.horasLiberadas = Number(data.horasLiberadas) || 0;
    resumenProgreso.horasFaltantes = Number(data.horasFaltantes) || 480;

    horasEl.innerText = resumenProgreso.horasLiberadas;
    faltantesEl.innerText = resumenProgreso.horasFaltantes;

    actividadesOriginalesProgreso = Array.isArray(data.actividades)
      ? data.actividades
      : [];

    aplicarFiltroProgreso();
  } catch (error) {
    console.error("Error de conexión:", error);
  }
}

/* =========================================================
   DETERMINAR SI UN PROYECTO ESTÁ CONCLUIDO
========================================================= */

// Un proyecto se considera concluido cuando
// todas sus tareas están marcadas como cumplidas
function esProyectoConcluido(act) {
  const total = Number(act.total_tareas) || 0;
  const completadas = Number(act.tareas_completadas) || 0;

  return total > 0 && completadas === total;
}

/* =========================================================
   CAMBIAR FILTRO DE PROGRESO
========================================================= */

// Cambia el filtro actual y vuelve a dibujar la vista
function cambiarFiltroProgreso(tipo) {
  filtroProgreso = tipo;
  actualizarBotonesFiltroProgreso();
  aplicarFiltroProgreso();
}

/* =========================================================
   ACTUALIZAR BOTONES DE FILTRO
========================================================= */

// Recorre los botones y deja activo el filtro actual
function actualizarBotonesFiltroProgreso() {
  const botones = document.querySelectorAll(".filtro-progreso");

  botones.forEach((btn) => {
    btn.classList.remove("active");

    const texto = btn.textContent.toLowerCase();

    if (filtroProgreso === "Todos" && texto.includes("todos")) {
      btn.classList.add("active");
    }

    if (filtroProgreso === "Concluidos" && texto.includes("concluidos")) {
      btn.classList.add("active");
    }

    if (filtroProgreso === "Pendientes" && texto.includes("pendientes")) {
      btn.classList.add("active");
    }
  });
}

/* =========================================================
   APLICAR FILTRO
========================================================= */

// Toma todas las actividades y aplica el filtro actual
function aplicarFiltroProgreso() {
  let filtradas = [...actividadesOriginalesProgreso];

  if (filtroProgreso === "Concluidos") {
    filtradas = filtradas.filter((act) => esProyectoConcluido(act));
  } else if (filtroProgreso === "Pendientes") {
    filtradas = filtradas.filter((act) => !esProyectoConcluido(act));
  }

  renderizarProgreso(filtradas);
}

/* =========================================================
   RENDERIZAR PROGRESO
========================================================= */

// Dibuja las tarjetas de actividades inscritas
// Ahora sí muestra:
// - fecha de inicio
// - fecha de término
// - nombre del proyecto en el modal de tareas
function renderizarProgreso(actividades) {
  const contenedor = document.getElementById("listaProgreso");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (!actividades || actividades.length === 0) {
    contenedor.innerHTML = `
      <div class="col-12 text-center py-5">
        <p class="text-muted">No hay proyectos para este filtro.</p>
      </div>
    `;
    return;
  }

  actividades.forEach((act) => {
    const totalTareas = Number(act.total_tareas) || 0;
    const tareasCompletadas = Number(act.tareas_completadas) || 0;
    const horasGanadas = Number(act.horas_ganadas) || 0;
    const horasActividad = Number(act.horas_actividad) || 0;

    const porcentaje =
      totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0;

    let badgeClase = "bg-secondary";
    if (act.estado_actividad === "Activa") badgeClase = "bg-success";
    if (act.estado_actividad === "Finalizada") badgeClase = "bg-primary";
    if (act.estado_actividad === "Pendiente")
      badgeClase = "bg-warning text-dark";
    if (act.estado_actividad === "Cancelada") badgeClase = "bg-danger";

    const estatusAlumnoVista = esProyectoConcluido(act)
      ? "Concluido"
      : "Pendiente";

    const fechaInicio = formatearFecha(act.fecha_alta);
    const fechaTermino = formatearFecha(act.fechaTermino);

    contenedor.innerHTML += `
      <div class="col-md-6 mb-3">
        <div class="card h-100 border-0 shadow-sm">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title text-primary mb-0">
                ${escaparHTML(act.nombreActividad)}
              </h5>
              <span class="badge ${badgeClase}">
                ${escaparHTML(act.estado_actividad)}
              </span>
            </div>

            <p class="text-muted small mb-3">
              ${escaparHTML(act.descripcion || "Sin descripción")}
            </p>

            <!-- Fechas de la actividad -->
            <div class="row small mb-3">
              <div class="col-6">
                <strong>Inicio:</strong><br>
                ${escaparHTML(fechaInicio)}
              </div>

              <div class="col-6">
                <strong>Término:</strong><br>
                ${escaparHTML(fechaTermino)}
              </div>
            </div>

            <hr>

            <div class="row small mb-3">
              <div class="col-6">
                <strong>Estatus Alumno:</strong><br>
                ${escaparHTML(estatusAlumnoVista)}
              </div>

              <div class="col-6">
                <strong>Horas Ganadas:</strong><br>
                ${horasGanadas} / ${horasActividad}
              </div>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between mb-1 small">
                <span>Progreso de tareas</span>
                <span>${porcentaje}%</span>
              </div>

              <div class="progress" style="height: 10px;">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  style="width: ${porcentaje}%"
                  aria-valuenow="${porcentaje}"
                  aria-valuemin="0"
                  aria-valuemax="100"
                ></div>
              </div>
            </div>

            <div class="d-grid gap-2 d-md-block">
              <button
                class="btn btn-outline-info btn-sm"
                data-bs-toggle="modal"
                data-bs-target="#modalTareas"
                onclick='verTareasAlumno(${act.idactividad}, ${JSON.stringify(
                  act.nombreActividad || "",
                )})'
              >
                📋 Ver tareas
              </button>

              <button
                class="btn btn-outline-primary btn-sm"
                data-bs-toggle="modal"
                data-bs-target="#modalResponsable"
                onclick="verResponsable(${act.idactividad})"
              >
                👤 Responsable
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

/* =========================================================
   LIMPIEZA MANUAL DE MODALES
========================================================= */

// Elimina manualmente restos del modal si Bootstrap deja el fondo atorado
function forzarLimpiezaModal() {
  const backdrops = document.querySelectorAll(".modal-backdrop");
  backdrops.forEach((b) => b.remove());

  document.body.classList.remove("modal-open");
  document.body.style.overflow = "auto";
  document.body.style.paddingRight = "0";
}

/* =========================================================
   VER TAREAS DE UNA ACTIVIDAD
   - Obtiene las tareas del alumno para una actividad
   - Muestra el nombre del proyecto
   - Muestra fecha de cada tarea
========================================================= */

async function verTareasAlumno(idactividad, nombreActividad = "") {
  nombreActividadActualModal = nombreActividad || "";

  const subtitulo = document.getElementById("modalTareasSubtitulo");
  const listaChecklistAlumno = document.getElementById("listaChecklistAlumno");

  if (subtitulo) {
    subtitulo.textContent = nombreActividadActualModal
      ? `Proyecto: ${nombreActividadActualModal}`
      : "";
  }

  if (listaChecklistAlumno) {
    listaChecklistAlumno.innerHTML = `
      <div class="list-group-item text-center text-muted py-3">
        Cargando tareas...
      </div>
    `;
  }

  forzarLimpiezaModal();

  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/progreso/tareas/${idactividad}`,
      {
        headers: getHeaders(),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      console.error(data.msg || "Error al obtener tareas");
      if (listaChecklistAlumno) {
        listaChecklistAlumno.innerHTML = `
          <div class="list-group-item text-center text-danger py-3">
            No se pudieron cargar las tareas.
          </div>
        `;
      }
      return;
    }

    const nombreProyecto =
      data.nombreActividad || nombreActividadActualModal || "";
    const tareas = Array.isArray(data.tareas) ? data.tareas : [];

    if (subtitulo) {
      subtitulo.textContent = nombreProyecto
        ? `Proyecto: ${nombreProyecto}`
        : "";
    }

    if (!listaChecklistAlumno) return;

    listaChecklistAlumno.innerHTML = "";

    if (tareas.length === 0) {
      listaChecklistAlumno.innerHTML = `
        <div class="list-group-item text-center text-muted py-3">
          No hay tareas registradas para esta actividad.
        </div>
      `;
      return;
    }

    tareas.forEach((t) => {
      const cumplida = t.estatus === "Cumplida";
      const fechaInicio = formatearFecha(t.fechaInicio);
      const fechaFin = formatearFecha(t.fechaFin);

      listaChecklistAlumno.innerHTML += `
        <div class="list-group-item checklist-item d-flex justify-content-between align-items-center py-3">
          <div>
            <h6 class="mb-1 fw-bold">${escaparHTML(t.nombre_tarea)}</h6>
            <small class="text-muted d-block">
              ${Number(t.horas_Tareas) || 0} horas asignadas
          <small class="text-muted d-block">
              Inicio: ${escaparHTML(fechaInicio)}
          </small>
          <small class="text-muted d-block">
              Fin: ${escaparHTML(fechaFin)}
          </small>
          </div>

          <span class="estado-tarea-pill ${
            cumplida ? "estado-tarea-cumplida" : "estado-tarea-pendiente"
          }">
            ${cumplida ? "✓ Cumplida" : "Pendiente"}
          </span>
        </div>
      `;
    });
  } catch (error) {
    console.error(error);

    if (listaChecklistAlumno) {
      listaChecklistAlumno.innerHTML = `
        <div class="list-group-item text-center text-danger py-3">
          Error de conexión al cargar las tareas.
        </div>
      `;
    }
  }
}

/* =========================================================
   VER RESPONSABLE DE UNA ACTIVIDAD
========================================================= */

// Consulta los datos del responsable de la actividad
async function verResponsable(idActividad) {
  forzarLimpiezaModal();

  try {
    const res = await fetch(
      `http://127.0.0.1:3000/responsable/${idActividad}`,
      {
        headers: getHeaders(),
      },
    );

    const data = await res.json();

    if (!res.ok) return;

    const resNombre = document.getElementById("resNombre");
    const resTelefono = document.getElementById("resTelefono");
    const resUbicacion = document.getElementById("resUbicacion");

    if (resNombre) resNombre.innerText = data.nombre || "No asignado";
    if (resTelefono) resTelefono.innerText = data.telefono || "N/A";
    if (resUbicacion) resUbicacion.innerText = data.ubicacion || "N/A";
  } catch (error) {
    console.error(error);
  }
}

/* =========================================================
   FUNCIONES GLOBALES
========================================================= */

// Permite que los botones del HTML llamen estas funciones
window.cambiarFiltroProgreso = cambiarFiltroProgreso;
window.verTareasAlumno = verTareasAlumno;
window.verResponsable = verResponsable;
